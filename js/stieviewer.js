/**
 * Created by Bert on 24/03/2016.
 */

var stieviejs = new Stievie("http://proxy.bertware.net/proxy", "http://proxy.bertware.net/");

var onSignIn = function (result) {
    if (!result) {
        alert("Login failed!")
    }
    stieviejs.getChannels(null, true);
};

var signIn = function () {
    if (!stieviejs.hasValidAuthHash()) {
        var user = window.prompt("Username", "");
        var pass = window.prompt("Password", "");
        stieviejs.signIn(user, pass, onSignIn);
    } else {
        stieviejs.getChannels(null, true);
    }
};

var onChannelsUpdated = function (channels) {
    var container = $('[data-role="stievie-channels"]');
    container.html(""); // clear existing data
    for (var k in channels) {
        if (!channels.hasOwnProperty(k)) continue;
        var channel = channels[k];

        var id = channel.ID;
        var name = decodeURI(channel.Name);
        var icon_src = decodeURI(channel.LightIcon);

        var stream = channel.Streams[0].ID;
        var stream_url = channel.Streams[0].Url;

        var div =
            $('<div class="channel" data-type="list-channel" data-channel-id="' + id + '" data-stream="' + stream + '" data-stream-url="' + stream_url + '" title="' + name + '">' +
                '<img class="channel-thumb" src="' + icon_src + '" alt="' + name + '">' +
                '<div class="channel-detail"></div>' +
                '</div>');
        container.append(div);
    }

    container.each(function () {
        var $this = $(this);
        $this.append($this.find('[data-type="list-channel"]').get().sort(function (a, b) {
            return $(a).data('channel-id') - $(b).data('channel-id');
        }));
    });
};

var onEpgUpdated = function (epg) {
    var container = $('[data-role="stievie-epg"]');
    container.html(""); // clear existing data

    for (var c in epg.Channels) {
        if (!epg.Channels.hasOwnProperty(c)) continue;
        var epgChannel = epg.Channels[c];

        var channelContainer = $('' +
            '<div class="epg-channel" data-type="epg-channel" data-channel-id="' + epgChannel.ID + '">' +
            '   <div class="epg-channel-header">' +
            '       <h2 class="epg-channel-header-name">' + epgChannel.Name + '</h2>' +
            '       <div class="epg-channel-header-current">' +
            '           <div class="channel-detail-row">' +
            '               <span class="channel-detail-start">' + epgChannel.Current.FormatTime + '</span>' +
            '               <span class="channel-detail-name">' + epgChannel.CurrentName + '</span>' +
            '               <span class="channel-detail-end">' + epgChannel.Current.FormatEndTime + '</span>' +
            '           </div>' +
            '           <div class="channel-detail-row channel-detail-row-thin">' +
            '               <progress max="' + epgChannel.Current.Duration + '" value="' + (Math.floor(new Date().getTime() / 1000) - epgChannel.Current.Time) + '"></progress>' +
            '           </div>' +
            '           <div class="clearfix"></div>' +
            '       </div>' +
            '   </div>' +
            '</div>');

        var channelthumb = $('<div class="epg-channel-thumb"><img class="epg-channel-thumb-img" data-type="thumb" data-src="' + epgChannel.Thumb + '" src="' + stieviejs.getCurrentThumbnail(epgChannel.Thumb) + '"><img class="epg-channel-thumb-transition" data-type="thumbreplacement" src=""></div>');
        var epgcontainer = $('<div class="epg-list"></div>');

        var clearfix = $('<div class="clearfix"></div>');

        for (var p in epgChannel.Programs) {
            if (!epgChannel.Programs.hasOwnProperty(p)) continue;
            var program = epgChannel.Programs[p];

            if (!program.Past && !program.Live) continue;

            var entry = '<div class="epg-program" data-type="program" data-time="' + program.Time + '" data-stream="' + epgChannel.Stream  + '" title="' + program.Name + '" data-thumb="' + program.Thumb + '">' +
                '<span class="epg-program-time">' + program.FormatDate + '</span>' +
                ' <span class="epg-program-time">' + program.FormatTime + '</span>' +
                ' <span class="epg-program-name">' + program.Name + '</span>' +
                ' <span class="epg-program-endtime">(' + program.FormatEndTime + ')</span>' +
                '</div>';

            epgcontainer.prepend(entry);

        }

        channelContainer.append(channelthumb);
        channelContainer.append(epgcontainer);
        channelContainer.append(clearfix);
        // update sidebar
        var detail = $('.channel[data-channel-id="' + epgChannel.ID + '"] .channel-detail')

        detail.html(
            '<div class="channel-detail-row">' +
            '<span class="channel-detail-start">' + epgChannel.Current.FormatTime + '</span>' +
            '<span class="channel-detail-name">' + epgChannel.CurrentName + '</span>' +
            '<span class="channel-detail-end">' + epgChannel.Current.FormatEndTime + '</span>' +
            '</div>' +
            '<div class="channel-detail-row">' +
            '<progress max="' + epgChannel.Current.Duration + '" value="' + (Math.floor(new Date().getTime() / 1000) - epgChannel.Current.Time) + '"></progress>' +
            '</div>'
        );

        container.append(channelContainer);
        channelContainer.hide();
    }

    selectChannel(1);
};

$('[data-role="stievie-epg"]').on('click', '[data-type="program"]', function () {
    playProgram($(this).data('stream'), $(this).data('time'));
});

$('[data-role="stievie-channels"]').on('click', '[data-type="list-channel"]', function () {
    selectChannel($(this).data('channel-id'));
});

var thumbInterval;
var selectedChannel;
var selectChannel = function (id) {
    if (thumbInterval) window.clearInterval(thumbInterval);

    $('[data-type="list-channel"]').removeClass("channel-selected");
    $('[data-type="list-channel"][data-channel-id="' + id + '"]').addClass('channel-selected');

    $('[data-type="epg-channel"]').hide();
    var selected = $('[data-type="epg-channel"][data-channel-id="' + id + '"]');

    // update thumb
    var thumb = selected.find('[data-type="thumb"]');
    thumb.attr("src", stieviejs.getCurrentThumbnail(thumb.data('src')));

    selected.show();

    selectedChannel = id;
    thumbInterval = setInterval(updateThumb, 5 * 1000);
};

var updateThumb = function () {
    var img = $('[data-type="epg-channel"][data-channel-id="' + selectedChannel + '"] img[data-type="thumb"]');
    var replace = $('[data-type="epg-channel"][data-channel-id="' + selectedChannel + '"] img[data-type="thumbreplacement"]');
    replace.attr('src', stieviejs.getCurrentThumbnail(img.data("src")));

    img.fadeOut(1000, function () {
            img.attr('src', stieviejs.getCurrentThumbnail(img.data("src")));
        })
        .fadeIn(100);
};

function playProgram(stream, time) {
    //$(".content-player").html(createVideo(stream));
    stream += "&starttimestampdef=" + getStarttimestampdef(time);
    videojs('player').src({type: "application/x-mpegURL", src: stream});
    //$('[data-role="stievie-player"] source').attr("src", stream);
    //$('[data-role="stievie-player"]').load();
}

function getStarttimestampdef(time) {

    var delta = new Date().getTimezoneOffset() * 60 * 1000;
    var date = new Date(time * 1000 + delta);

    var y = date.getFullYear();
    var M = (date.getMonth() + 1).padleft(2);
    var d = date.getDate().padleft(2);
    var h = date.getHours().padleft(2);
    var m = date.getMinutes().padleft(2);
    var s = date.getSeconds().padleft(2);

    return y + M + d + h + m + s + "000";

}
stieviejs.onChannelsUpdated = onChannelsUpdated;
stieviejs.onEpgUpdated = onEpgUpdated;

console.log("Requesting sign in");
signIn();
