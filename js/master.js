/*jslint browser: true, devel: true, sloppy: true, todo: true, white: true */

var AudioPlayer = function(options) {
	
	var my = this,
		buffering = false;
	
	var defaults = {
			'rate': 1,
			'smartSpeed': false,
			'url': false
		};
	
	my.init = function(options) {
		var counter;
		
		my.settings = defaults;
		
		if(typeof options !== undefined) {
			if(typeof options === 'string') {
				my.settings.url = options;
			} else {
				for(counter in my.settings) {
					if(
						my.settings.hasOwnProperty(counter) &&
						options.hasOwnProperty(counter)
					) {
						my.settings[counter] = options[counter];
					}
				}
			}
		}
		
		my.create();
	};
	
	my.create = function() {
		var request = new XMLHttpRequest();
		request.open('GET', my.settings.url, true);
		request.responseType = 'arraybuffer';

		request.onload = function() {
			console.log('Recieved ' + my.settings.url);
			
			my.context.decodeAudioData(
				request.response, 
				my.process, 
				my.bufferError
			);
		};
		
		console.log('Requesting ' + my.settings.url);
		request.send();
		buffering = true;
	};
	
	my.bufferError = function() {
		throw new Error('Audio decoding failed for ' + my.settings.url);
	};
	
	my.process = function(buffer) {
		var buffer_channel,
			source_channel, 
			filtered_buffer,
			final_buffer,
			channel_counter = 0, 
			channel_length = buffer.numberOfChannels,
			sample_counter = 0,
			sample_length = 0,
			used_sample_counter = 0,
			cache = [],
			cache_channels = [],
			cache_length,
			cache_count,
			cache_sum;
		
		console.log('Processing ' + my.settings.url);
		
		my.source = my.context.createBufferSource();
		
		filtered_buffer = my.context.createBuffer(
			buffer.numberOfChannels, 
			buffer.sampleRate * buffer.duration, 
			buffer.sampleRate
		);
		
		// If we're using smartspeed, the file needs processing.
		if(my.settings.smartSpeed === true) {
			buffer_channel = [];
			source_channel = [];
			used_sample_counter = 0;
			
			// Get all the channel data out for processing.
			for(; channel_counter < channel_length; channel_counter++) {
				buffer_channel[channel_counter] = buffer.getChannelData(channel_counter);
				source_channel[channel_counter] = filtered_buffer.getChannelData(channel_counter);
			}
			
			// Loop the samples to decide what gets kept.
			for(
				sample_counter = 0, sample_length = buffer_channel[0].length;
				sample_counter < sample_length;
				sample_counter++
			) {
				cache_sum = 0;
				cache_channels = [];
				
				// Store a sum of the channels to average and the actual channel data.
				for(channel_counter = 0; channel_counter < channel_length; channel_counter++) {
					cache_sum += buffer_channel[channel_counter][sample_counter];
					cache_channels[channel_counter] = buffer_channel[channel_counter][sample_counter];
				}
				cache.push([cache_sum/channel_length, cache_channels]);
				
				// Process and flush cache every .25s of data (I think).
				if(cache.length >= buffer.sampleRate / 4) {
					
					// Sum the cache for the current interval.
					cache_sum = 0;
					for(
						cache_count = 0, cache_length = cache.length;
						cache_count < cache_length;
						cache_count++
					) {
						cache_sum += Math.abs(cache[cache_count][0]);
					}
					
					// If the current interval meets the requirement, write it to the buffer.
					if(Math.abs(cache_sum/cache_length) >= 0.003) {
						for(
							cache_count = 0, cache_length = cache.length;
							cache_count < cache_length;
							cache_count++
						) {
							//if(sample_counter%my.settings.rate === 0) {
								for(channel_counter = 0; channel_counter < channel_length; channel_counter++) {
									source_channel[channel_counter][used_sample_counter] = 
										cache[cache_count][1][channel_counter];
								}
								used_sample_counter++;
							//}
						}
					}
					
					// Reset the cache.
					cache = [];
				}
			}
		
		// If we aren't using smartspeed, just copy everything over to the source buffer.
		} else {
			for(; channel_counter < channel_length; channel_counter++) {
				buffer_channel = buffer.getChannelData(channel_counter);
				source_channel = filtered_buffer.getChannelData(channel_counter);
				used_sample_counter = 0;
				
				for(
					sample_counter = 0, sample_length = buffer_channel.length;
					sample_counter < sample_length;
					sample_counter++
				) {
					//if(sample_counter%my.settings.rate === 0) {
						source_channel[used_sample_counter] = buffer_channel[sample_counter];
						used_sample_counter++;
					//}
				}
			}
		}
		
		// Create the final buffer so we can copy everything over.
		final_buffer = my.context.createBuffer(
			filtered_buffer.numberOfChannels, 
			filtered_buffer.sampleRate * filtered_buffer.duration, 
			filtered_buffer.sampleRate
		);
		
		// Loop the filtered buffer and copy it to the final buffer.
		for(
			channel_counter = 0, channel_length = filtered_buffer.numberOfChannels;
			channel_counter < channel_length;
			channel_counter++
		) {
			buffer_channel = filtered_buffer.getChannelData(channel_counter);
			source_channel = final_buffer.getChannelData(channel_counter);
			
			for(
				sample_counter = 0, sample_length = buffer_channel.length;
				sample_counter < sample_length;
				sample_counter++
			) {
				source_channel[sample_counter] = buffer_channel[sample_counter];
			}
		}
		
		console.log(filtered_buffer.duration);
		
		my.source.buffer = final_buffer;
		my.source.connect(my.context.destination);
		
		buffering = false;
		my.play();
	};
	
	my.play = function() {
		console.log('Playing ' + my.settings.url);
		my.playing = true;
		my.source.start(0);
	};
	
	my.stop = function() {
		my.source.stop(0);
	};
	
	// Create audio context.
	try {
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		my.context = new AudioContext();
	}
	catch(e) {}
	
	// Audio source.  Outputs from the buffer.
	my.source = false;
	
	// Audio buffer.  Reads and "parses" the audio file.
	my.buffer = false;
	
	// Whether we are playing anything.
	my.playing = false;
	
	// Initialize the settings.
	my.init(options, defaults);
	
	return this;
};

document.body.addEventListener(
	'click', 
	function(e){
		var t = e.target,
			p = t.parentNode,
			audio;
		
		if(t.classList.contains('audio-play')) {
			if(p.audio) {
				p.audio.play();
			} else {
				audio = new AudioPlayer(
					{
						url: p.getAttribute('data-src'),
						smartSpeed: true,
						rate: 2
					}
				);
				p.audio = audio;
			}
		}
		if(t.classList.contains('audio-stop')) {
			if(p.audio) {
				p.audio.stop();
			}
		}
	}
);