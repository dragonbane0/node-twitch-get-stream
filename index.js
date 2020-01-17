var request = require('request-promise');
var M3U = require('playlist-parser').M3U;
var qs = require('querystring');
var perf = require('perf_hooks');

var clientId;

// Thanks michaelowens, :)
// Simple titlecase thing, capitalize first letter
var titleCase = function (str) {
    return str.split(' ').map(function (word) { return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(); }).join(' ');
};


// Twitch functions
var getAccessToken = function (channel) {
    // Get access token
    return request.get('https://api.twitch.tv/api/channels/' + channel + '/access_token?platform=_', {
        json: true,
        headers: {
            'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko', //clientId,  //twitch client id
            'Accept': 'application/vnd.twitchtv.v5+json; charset=UTF-8'
        }
    }).then(function (res) {
        return res;
    });
};

var getPlaylist = function (channel, accessToken) {
    // Get the playlist with given access token data (parsed /access_token response)
    var query = {
        player: 'twitchweb',
        token: accessToken.token,
        sig: accessToken.sig,
        allow_audio_only: 'true',
        allow_source: 'true',
        fast_bread: 'true',
        playlist_include_framerate: 'true',
        type: 'any',
        p: Math.floor(Math.random() * 99999) + 1
    };

    return request.get('https://usher.ttvnw.net/api/channel/hls/' + channel + '.m3u8?' + qs.stringify(query), {
        headers: {
            'Client-ID': clientId
        },
        time: true,
        resolveWithFullResponse: true
    }).then(function (res) {
        return res;
    });
};

// Exposed functions
// Just get the playlist, return the string nothing else
var getPlaylistOnly = function (channel) {
    if (!channel)
        return Promise.reject(new Error('No channel defined.'));

    channel = channel.toLowerCase(); // Twitch API only takes lowercase
    return getAccessToken(channel)
        .then(function (token) {
            return getPlaylist(channel, token);
        });
};

// Above get playlist, but then parses it and gives the object
var getPlaylistParsed = function (channel) {
    if (!channel)
        return Promise.reject(new Error('No channel defined.'));

    return getPlaylistOnly(channel)
        .then(function (data) {
            // basically parse then _.compact (remove falsy values)
            return M3U.parse(data.body).filter(function (d) { return d; });
        });
};

var getStreamUrls = function (channel) { // This returns the one with a custom fully parsed object
    return getPlaylistOnly(channel)
        .then(function (playlist) {

            let processingStartTS = perf.performance.now();
            let downloadTime = playlist.timingPhases.download;

            playlist = playlist.body;

            let rawData = playlist;
            playlist = M3U.parse(playlist).filter(function (d) { return d; });

            if (playlist.length < 1)
                throw new Error('There were no results, maybe the channel is offline?');

            // Parse playlist with quality options and send to new array of objects
            var streamLinks = [];
            for (var i = 0; i < playlist.length; i++) {
                // Quality option
                var name = playlist[i].title.match(/VIDEO=('|")(.*?)('|")/); // Raw quality name
                name = name[2]; // Get regex captured group

                // Rename checks
                // chunked = source
                if (name === 'chunked') name = 'source';
                // audio_only = Audio Only
                else if (name === 'audio_only') name = 'audio only';

                // Resolution
                var resMatch = playlist[i].title.match(/RESOLUTION=(.*?),/);
                var res = resMatch ? resMatch[1] : null; // Audio only does not have a res so we need this check

                // Framerate
                var fpsMatch = playlist[i].title.match(/FRAME-RATE=(.*?)$/);
                var fps = fpsMatch ? Number.parseFloat(fpsMatch[1]) : null; // Audio only does not have a fps so we need this check

                // Bandwith/Bitrate (in bytes)
                var bandwithMatch = playlist[i].title.match(/BANDWIDTH=(.*?),/);
                var bandwith = bandwithMatch ? Number.parseInt(bandwithMatch[1]) : null;

                streamLinks.push({
                    quality: titleCase(name), // Title case the quality
                    resolution: res,
                    framerate: fps,
                    bitrate: bandwith,
                    url: playlist[i].file
                });
            }

            let processingTime = perf.performance.now() - processingStartTS;

            return {
                masterPlaylist: rawData, streamLinks: streamLinks, timeSincePlaylistCreation: downloadTime + processingTime
            };
        });
};

module.exports = 
    function(clid) {
        clientId = clid;
        return {
            get: getStreamUrls,
            raw: getPlaylistOnly,
            rawParsed: getPlaylistParsed          
        };
    };
