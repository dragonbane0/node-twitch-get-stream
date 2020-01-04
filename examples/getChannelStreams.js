
var twitchStreams = require('../')("");

twitchStreams.get('speedgaming')
    .then(function(streams) {
        console.log('Got stream data.', streams);

        for (var stream of streams.streamLinks)
            console.log(stream.quality + ' (' + stream.resolution + '): ' + stream.url);
    })
    .catch(function(error) {
        if (error)
            return console.log('Error caught:', error);
    });