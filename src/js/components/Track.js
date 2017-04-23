import { query, queryOne } from '@artcommacode/q';
import makeStem from './Stem';

/**
 * Receives a DOM element with links to audio files to be played in tandem as stems.
 * Returns an object with play/pause/mute methods
 * @param  {DOM element} element
 * @return {Stem}
 */
function makeTrack(el, trackIndex, publisher) {
	const track = {};
	track.element = el;
	const stemSources = JSON.parse(track.element.getAttribute('data-stems'));

	const stems = [];
	let loadedStems = 0;

	// add each element to the tracks array.
	stemSources.map((stemElement) => {
		const stem = makeStem(stemElement);
		stems.push(stem);
	});

	/**
	 * METHODS
	 */

	track.play = function playTrack() {
		track.active = true;
		stems.map(stem => stem.play());
		publisher.emit('enableButtons', stems.length);
		track.element.classList.add('playing');
	};

	track.stop = function stopTrack() {
		track.active = false;
		stems.map(stem => stem.reset());
		publisher.emit('enableButtons', stems.length);
		track.element.classList.remove('playing');
	};


	/**
	 * FUNCTIONS
	 */


	/**
	 * Track the number of loaded stems.
	 * Set error status if necessary.
	 */
	function stemLoadedHandler(err) {
		loadedStems += 1;
		if (err) {
			track.hasError = true;
			track.element.classList.add('has-errors');
		}
		if (loadedStems === stems.length) {
			track.isLoaded = true;
			track.element.classList.remove('loading');
			track.element.classList.add('loaded');
		}
	}

	/**
	 * If the track hasn't loaded, load the stems. Otherwise, play.
	 */
	function handleClick() {
		if (!track.isLoaded) {
			track.element.classList.add('loading');
			stems.map(stem => stem.load(stemLoadedHandler));
		} else {
			publisher.emit('trackPlayed', trackIndex);
			track.play();
		}
	}

	/*
   * EVENTS
	 */
	track.element.addEventListener('click', handleClick);

	publisher.subscribe('trackPlayed', (newIndex) => {
		if (newIndex !== trackIndex) {
			track.active = false;
			track.stop();
		}
	});

	publisher.subscribe('stemActivated', (stemIndex) => {
		if (track.active) stems[stemIndex].unmute();
	});

	publisher.subscribe('stemDeactivated', (stemIndex) => {
		if (track.active) stems[stemIndex].mute();
	});

	publisher.subscribe('allStemsActivated', () => {
		if (track.active) {
			stems.map(stem => stem.play());
			publisher.emit('enableButtons', stems.length);
		}
	})

	/**
	 * Debug logging
	 */

	const debugOutput = queryOne('#debug-output');

	publisher.subscribe('trackPlayed', () => {
		debugOutput.innerHTML = '';
	});

	function pad(input, padLength = 2, char = '0', direction = 'right') {
		let string = input.toString();
		const diff = padLength - input.length;
		for (let i = 0; i < diff; i += 1) {
			if (direction === 'right') {
				string += char;
			} else {
				string = char + string;
			}
		}
		return string;
	}

	function formatDecimal(input, lLength, rLength) {
		const arr = input.toString().split('.');
		if (arr.length === 1) arr.push('0');
		const whole = pad(arr[0], lLength, '0', 'left');
		const dec = pad(arr[1], rLength, '0', 'right').substr(0, rLength);
		return `${whole}.${dec}`;
	}

	setInterval(() => {
		if (track.active) {
			const debugString = ['*******'];
			let min;
			let max;
			stems.map((stem, index) => {
				if (stem.audio) {
					const activated = (stem.active) ? 'activated' : 'deactivated';
					const currentTime = Math.round(stem.audio.currentTime * 10000) / 10000;
					const formattedTime = formatDecimal(currentTime, 3, 4);

					min = (min) ? Math.min(min, currentTime) : currentTime;
					max = (max) ? Math.max(max, currentTime) : currentTime;
					if (currentTime === 0) stem.audio.play();
					debugString.push(`   stem ${index}: ${formattedTime} | ${stem.fileName} - ${activated} | ${stem.audio.buffered.end(0)} / ${stem.audio.duration}`);
				}
			});
			const diff = formatDecimal(max - min, 1, 6);
			debugString.push(`   max diff: ${diff}`);
			debugOutput.innerHTML = debugString.join('<br>');
		}
	}, 100);

	track.stemsCount = stems.length;


	return track;
}


export default makeTrack;
