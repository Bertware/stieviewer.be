function sha1(message) {
	var shaObj = new jsSHA("SHA-1", "TEXT");
	shaObj.update(message);
	return shaObj.getHash("HEX");
};

function setCookie(name, value, expire_hours) {
    var d = new Date();
    d.setTime(d.getTime() + (expire_hours * 60 * 60 * 1000));
    var expires = "expires=" + d.toUTCString();
    document.cookie = name + "=" + value + "; " + expires;
}

function getCookie(name) {
    name += "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1);
        if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
    }
    return "";
}

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}

function timestamp() {
    return Math.floor((new Date).getTime() / 1000);
}
