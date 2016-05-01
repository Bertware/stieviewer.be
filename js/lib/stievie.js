/**
 * Created by Bert on 24/03/2016.
 */

function Stievie(apiProxy,streamProxy) {
    this._baseUrl = apiProxy + Stievie.BaseUrlPrefix;
    this._baseUrlV2 = apiProxy + Stievie.BaseUrlV2Prefix;
    this._M3U8Proxy = streamProxy;
    this._deviceId = localStorage.getItem("guid");
    this._authHash = localStorage.getItem("auth");
    this._authHashValidUntil = localStorage.getItem("authvalid");
    if (this._deviceId == null) {
        this._deviceId = guid();
        localStorage.setItem("guid", this._deviceId);
    }
}

$.ajaxSetup({
    beforeSend: function (xhr) {
        xhr.setRequestHeader('User-Agent', Stievie.AndroidUserAgent);
    }
});

// Base URL's
Stievie.M3U8Base = "https://playlistsvr-stievie.triple-it.nl:443/";
Stievie.prototype._M3U8Proxy = "";
// Stievie.prototype.BaseUrlV2 = "https://vinson-stievie.triple-it.nl/V2Api/";
// Stievie.prototype.BaseUrl = "https://vinson-stievie.triple-it.nl/V1Api/";

Stievie.BaseUrlV2Prefix = "/V2Api/";
Stievie.BaseUrlPrefix = "/V1Api/";

// salt used for SHA1 hash in url signing , let's call it a lucky guess :-)
Stievie.VinsonSalt = "g6TTAK7kiL6tusOEfwje";

// Access details
Stievie.AndroidUserAgent = "Dalvik/1.6.0 (Linux; U; Android 4.4.4; Nexus 7 Build/KTU84P)";
Stievie.ApiKey = "androidprod";
Stievie.DeviceType = "asus - Nexus 7";

// GUID v4
Stievie.prototype._deviceId = null;

// Auth hash
Stievie.prototype._authHash = null;
//  Epoch timestamp containing valid until date
Stievie.prototype._authHashValidUntil = 0;

// JSON data accompagnied by
Stievie.prototype._channels = null;
// JSON data
Stievie.prototype._epg = null;
// Timestamp showing the last update time.
Stievie.prototype._channelsLastUpdated = 0;
// Timestamp showing the last update time.
Stievie.prototype._epgLastUpdated = 0;

Stievie.prototype.onEpgUpdated = null;
Stievie.prototype.onChannelsUpdated = null;


Stievie.prototype.hasValidAuthHash = function () {
    return (this._authHashValidUntil > timestamp());
};

Stievie.prototype.signVinsonRequestData = function (endpoint, data) {
    data = data.replace(/&$/, ''); // trim trailing '&'
    var signdata = data + "&" + endpoint + Stievie.VinsonSalt;
    var signature = sha1(signdata);
    data += "&sig=" + signature;
    return data;
};

Stievie.prototype.signIn = function (login, password, callback) {
    if (this.hasValidAuthHash()) {
        console.log("Skip Sign in, we already have a valid authHash");
        this.logOn();
        if (callback) callback(true);
        return;
    }

    console.log("Signing in");
    var url = "User/SignIn";
    var postdata = "apiKey=" + Stievie.ApiKey +
        "&deviceid=" + this._deviceId +
        "&devicetype=" + Stievie.DeviceType +
        "&password=" + password +
        "&sigtime=" + timestamp() +
        "&username=" + login;

    postdata = this.signVinsonRequestData(url, postdata);
    url = this._baseUrl + url;
    var instance = this;

    $.ajax({
            method: "POST",
            url: url,
            data: postdata
        })
        .done(function (response, textStatus, jqXHR) {

            /*
             {
             "ResponseCode": 200,
             "ResponseKey": "OK",
             "ResponseObject": {
             "result": true,
             "authhash": "5f86281ef5bf45739c4a02aaa339acb4",
             "validUntil": 1463332850
             },
             "ResponseTimestamp": 1458148850
             }
             */

            var responseCode = response.ResponseCode;
            var responseObject = response.ResponseObject;

            if (responseCode != 200) {
                console.log("Login request unsuccessful.");
                if (callback)   callback(false);
                return;
            }


            if (!responseObject.result) {
                console.log("Login unsuccessful. Are the username and password correct?");
                if (callback) callback(false);
                return;
            }

            instance._authHash = responseObject.authhash;
            instance._authHashValidUntil = responseObject.validUntil;

            localStorage.setItem("auth", instance._authHash);
            localStorage.setItem("authvalid", instance._authHashValidUntil);

            if (callback) callback(true);

        })
        .fail(function (jqXHR, textStatus, errorThrown) {
            if (callback)  callback(false);
        });

};

Stievie.prototype.logOn = function (callback) {
    console.log("Log On");

    var endPoint = "User/LogOn";

    var data = "apikey=" + Stievie.ApiKey + "&";
    data += "authhash=" + this._authHash + "&";
    data += "deviceid=" + this._deviceId + "&";
    data += "devicetype=" + Stievie.DeviceType + "&";
    data += "sigtime=" + timestamp() + "&";

    var postdata = this.signVinsonRequestData(endPoint, data);
    var url = this._baseUrl + endPoint;
    var instance = this;
    $.ajax({
            method: "POST",
            url: url,
            data: postdata
        })
        .done(function (response, textStatus, jqXHR) {

            console.log(response);
            instance.getChannels(function () {
                instance.getEPG(null, true);
            });
            if (callback)   callback(true);

        })
        .fail(function (jqXHR, textStatus, errorThrown) {
            instance.logOut();
            if (callback)   callback(false);
            console.log("Error during logon: " + textStatus);
            console.log(errorThrown);
        });
};

Stievie.prototype.logOut = function (callback) {
    this.authHash = "";
    this.authHashValidUntil = 0;

    localStorage.setItem("authHash", "");
    localStorage.setItem("authHashValidUntil", 0);

    if (callback) callback(true);
};

Stievie.prototype.getChannels = function (callback, updateEpg) {

    // channels already available
    if (this._channels && this._channels.length > 0) {
        if (callback) callback(this._channels);
        return this._channels;
    }

    // not available, refresh
    console.log("refreshing Channels");

    var endPoint = "Channel/GetChannelsWithStreams";

    var data = "apikey=" + Stievie.ApiKey + "&";
    data += "authhash=" + this._authHash + "&";
    data += "deviceid=" + this._deviceId + "&";
    data += "devicetype=" + Stievie.DeviceType + "&";
    data += "includeofflinechannels=true&";
    data += "sigtime=" + timestamp() + "&";
    data += "streamType=hd&";

    var postdata = this.signVinsonRequestData(endPoint, data);
    var url = this._baseUrl + endPoint;

    console.log("Getting channels: " + postdata);
    var instance = this;
    $.ajax({
            method: "POST",
            url: url,
            data: postdata
        })
        .done(function (response, textStatus, jqXHR) {
            //console.log(body);
            var responseObject = response.ResponseObject;

            if (responseObject.Channels) {

                instance._channels = responseObject.Channels;
                console.log(instance._channels.length + " channels found");
                instance._channelsLastUpdated = new Date().getTime();

                for ( var id  in instance._channels){
                    if (!instance._channels.hasOwnProperty(id)) continue;
                    var channel = instance._channels[id];
                    channel.Streams[0].Url = instance.getStream(channel.Streams[0].Url);
                }

                // stream urls are valid for 40 minutes: invalidate in 35 minutes to force refresh if needed
                setTimeout(function () {
                    instance._channels = [];
                }, 2100 * 1000);

                if (instance.onChannelsUpdated) instance.onChannelsUpdated(instance._channels);
                if (updateEpg) instance.getEPG(false, true);
                if (callback) callback(instance._channels);

            } else {
                console.error("No channels found ... API changed ? Status was " + textStatus);
                callback(false);
            }
        })
        .fail(function (jqXHR, textStatus, errorThrown) {
            callback(false);
            console.log("Error: " + textStatus);
            console.log(errorThrown);
        });

    return true;

};

Stievie.prototype.getEPG = function (callback, force) {

    if (this._epg && !force) {
        if (callback) callback(this._epg);
        return this._epg;
    }


    console.log("refreshing EPG");

    var channelIds = [];
    if (this._channels) {
        for (var i = 0; i < this._channels.length; i++) {
            channelIds.push(this._channels[i].ID);
        }
    }

    if (channelIds.length == 0) channelIds.push(1);

    var endPoint = "Program/GetOverview";

    var data = "apikey=" + Stievie.ApiKey + "&";
    data += "authhash=" + this._authHash + "&";
    data += "channelID=" + channelIds.join(",") + "&";
    data += "deviceid=" + this._deviceId + "&";
    data += "devicetype=" + Stievie.DeviceType + "&";
    data += "sigtime=" + timestamp() + "&";

    var postdata = this.signVinsonRequestData(endPoint, data);
    // this is a V2 API call
    var url = this._baseUrlV2 + endPoint;
    var instance = this;
    $.ajax({
            method: "POST",
            url: url,
            data: postdata
        })
        .done(function (response, textStatus, jqXHR) {

            var responseObject = response.ResponseObject;
            if (responseObject.Channels) {

                instance._epg = responseObject;
                instance._epgLastUpdated = new Date().getTime();

                console.log(instance._epg.Channels.length + " epg channels found");

                for (var cid in instance._epg.Channels) {

                    if (!instance._epg.Channels.hasOwnProperty(cid)) continue;

                    var epgChannel = instance._epg.Channels[cid];
                    var channel = instance.getChannelById(epgChannel.ID);
                    epgChannel.Name = channel.Name;
                    epgChannel.Stream = channel.Streams[0].Url;

                    var deltaTime = 0;
                    var now = new Date().getTime() / 1000;
                    var thumbUrl = channel.SpecificThumbnailUrl;

                    var lastPast = 0;

                    for (var pid in epgChannel.Programs) {

                        if (!epgChannel.Programs.hasOwnProperty(pid)) continue;
                        var program = epgChannel.Programs[pid];

                        deltaTime += program.Time;
                        program.Time = deltaTime;

                        var format = formatDate(deltaTime * 1000);

                        program.FormatTime = format[1];
                        program.FormatDate = format[0];


                        if (pid > 0) {
                            epgChannel.Programs[pid - 1].EndTime = program.Time;
                            epgChannel.Programs[pid - 1].FormatEndTime = program.FormatTime;
                            epgChannel.Programs[pid - 1].Duration = program.Time - epgChannel.Programs[pid - 1].Time;
                        }


                        if (program.Name) program.Name = instance.getProgramName(program.Name);
                        if (program.Tag) program.Tag = instance.getProgramTags(program.Tag);
                        if (program.SeriesName) program.SeriesName = instance.getSeriesName(program.SeriesName);
                        if (program.Url) program.Url = instance.getProgramUrl(program.Url);

                        program.ChannelId = channel.ID;
                        program.ChannelName = channel.Name;
                        program.Stream = channel.Streams[0].Url;

                        program.Past = deltaTime < now;
                        program.Live = false;
                        // store last past info for live details
                        if (program.Past) lastPast = pid;

                        var thumbTime = deltaTime - (deltaTime % 3) + 12;
                        program.Thumb = thumbUrl.replace("<unixtime>", thumbTime);
                    }

                    lastPast = epgChannel.Programs[lastPast];
                    
                    var live = {
                        Name: "Nu op " + epgChannel.Name + " (live)",
                        Time: 0,
                        Channel: cid,
                        Thumb: instance.getCurrentThumbnail(thumbUrl),
                        ChannelId: channel.ID,
                        Stream: channel.Streams[0].Url,
                        Live: true,
                        EndTime: lastPast.EndTime,
                        FormatEndTime: lastPast.FormatEndTime,
                        Duration: lastPast.Duration
                    };
                    format = formatDate(now * 1000);

                    live.FormatTime = format[1];
                    live.FormatDate = format[0];

                    epgChannel.Thumb = thumbUrl;
                    epgChannel.CurrentName = lastPast.Name;
                    epgChannel.Current = lastPast;

                    epgChannel.Programs.push(live);

                }


                //  invalidate in 60 minutes to force refresh if needed
                setTimeout(function () {
                    instance._epg = undefined;
                }, 3600 * 1000);

                if (instance.onEpgUpdated) instance.onEpgUpdated(instance._epg);
                if (callback) callback(instance._epg);

            } else {
                console.error("No epg found ... API changed ? Status was " + textStatus);
                console.error("Body was " + response);
                callback(false);
            }
        })
        .fail(function (jqXHR, textStatus, errorThrown) {
            callback(false);
            console.log("Error: " + textStatus);
            console.log(errorThrown);
        });
    return this._epg; // will be empty -> call again from client after some time;
};

Stievie.prototype.getChannelById = function (id) {
    for (var k in this._channels) {
        if (this._channels.hasOwnProperty(k) && this._channels[k].ID == id) {
            return this._channels[k];
        }
    }
    return false;
};

Stievie.prototype.getProgramsForChannel = function (id) {
    for (var k in this._epg.Channels) {
        if (this._epg.Channels.hasOwnProperty(k) && this._epg.Channels[k].ID == id) {
            return this._epg.Channels[k].Programs;
        }
    }
    return false;
};

Stievie.prototype.getProgramName = function (nameId) {
    if (this._epg.Names.hasOwnProperty(nameId)) {
        return this._epg.Names[nameId];
    }
    return false;
};

Stievie.prototype.getSeriesName = function (nameId) {
    if (this._epg.SeriesNames.hasOwnProperty(nameId)) {
        return this._epg.SeriesNames[nameId];
    }
    return false;
};

Stievie.prototype.getProgramUrl = function (nameId) {
    if (this._epg.Urls.hasOwnProperty(nameId)) {
        return this._epg.Urls[nameId];
    }
    return false;
};

Stievie.prototype.getProgramTags = function (nameId) {
    if (this._epg.Tags.hasOwnProperty(nameId)) {
        return this._epg.Tags[nameId];
    }
    return false;
};

Stievie.prototype.getCurrentThumbnail = function(url){
    var now = new Date().getTime() / 1000;
    var thumbTime = Math.floor(now - 60 - (now % 3));
    return url.replace("<unixtime>", thumbTime);
};

Stievie.prototype.getM3U8 = function (url, callback) {
    var m3u8Url = Stievie.M3U8Base + url;
    console.log("loading " + m3u8Url);
    $.ajax({
            method: "GET",
            url: url
        })
        .done(function (response, textStatus, jqXHR) {
            if (callback) callback(response);
        })
        .fail(function (jqXHR, textStatus, errorThrown) {
            if (callback) callback(false);
            console.log("Error while retrieving M3U8 playlist (this video won't play): " + textStatus);
            console.log(errorThrown);
        });
};

Stievie.prototype.getStream = function(url){
    return url.replace(Stievie.M3U8Base,this._M3U8Proxy);
};



var formatDate = function (time) {

    var date = new Date(time);

    var d = date.getDate().padleft(2);
    var M = (date.getMonth() + 1).padleft(2);
    var h = date.getHours().padleft(2);
    var m = date.getMinutes().padleft(2);

    return [d + "/" + M, h + ":" + m];
};

String.prototype.padleft = function (width) {
    return ('0'.repeat(width) + this.valueOf() ).substring(this.length);
};
Number.prototype.padleft = function (width) {
    return (this + '').padleft(width);
};
