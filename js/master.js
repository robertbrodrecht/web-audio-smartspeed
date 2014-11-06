/*jslint browser: true, devel: true, sloppy: true, todo: true, white: true */

// talkshow-001.mp3
// talkshow-089.mp3

// buildanalyze-105.mp3
// hypercritical-086.mp3

// debug11b.mp3

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
			last_second = [],
			last_second_length,
			last_second_count,
			last_second_avg;
		
		console.log('Processing ' + my.settings.url);
		
		my.source = my.context.createBufferSource();
		
		filtered_buffer = my.context.createBuffer(
			buffer.numberOfChannels, 
			buffer.sampleRate * buffer.duration, 
			buffer.sampleRate
		);
		
		for(; channel_counter < channel_length; channel_counter++) {
			buffer_channel = buffer.getChannelData(channel_counter);
			source_channel = filtered_buffer.getChannelData(channel_counter);
			
			for(
				sample_counter = 0, sample_length = buffer_channel.length;
				sample_counter < sample_length;
				sample_counter++
			) {
				// Keep a cache of the samples.
				last_second.push(buffer_channel[sample_counter]);
				
				// When we hit .25s of audio, decide if we want to keep it
				// by determining if the average of all samples is above
				// a certain number.
				if(last_second.length >= buffer.sampleRate / 4) {
					
					last_second_avg = 0;
					
					// Sum the array for averaging.
					for(
						last_second_count = 0, 
							last_second_length = last_second.length;
						last_second_count < last_second_length;
						last_second_count++
					) {
						last_second_avg += last_second[last_second_count];
					}
					
					// If smartspeed is disabled or the average meets criteria
					if(
						my.settings.smartSpeed === false || 
						Math.abs(last_second_avg/last_second_length) >= 0.00001
					) {
						// Loop the cached samples and add them to the source.
						for(
							last_second_count = 0, 
								last_second_length = last_second.length;
							last_second_count < last_second_length;
							last_second_count++
						) {
							source_channel[used_sample_counter] = 
								last_second[last_second_count];
							used_sample_counter++;
						}
					}
					
					last_second = [];
				}
			}
		}
		
		console.log(used_sample_counter, sample_counter, buffer.sampleRate * buffer.duration);
		
		// Create the final buffer so we can copy everything over.
		final_buffer = my.context.createBuffer(
			filtered_buffer.numberOfChannels, 
			used_sample_counter, 
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
		
		my.source.buffer = final_buffer;
		my.source.connect(my.context.destination);
		
		buffering = false;
		my.play();
	};
	
	my.play = function() {
		console.log('Playing ' + my.settings.url);
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
				audio = new AudioPlayer({url: p.getAttribute('data-src'), smartSpeed: true});
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