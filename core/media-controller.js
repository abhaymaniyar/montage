/* <copyright>
Copyright (c) 2012, Motorola Mobility LLC.
All Rights Reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice,
  this list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of Motorola Mobility LLC nor the names of its
  contributors may be used to endorse or promote products derived from this
  software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
</copyright> */
/**
    @module montage/ui/controller/media-controller
    @requires montage/core/core
    @requires montage/ui/component
    @requires montage/core/logger
*/
var Montage = require("montage").Montage;
var Target = require("core/target").Target;
var logger = require("core/logger").logger("mediacontroller");

/**
 @class MediaController
 @classdesc Controls an audio/video media player.
 @extends Montage

 */
var MediaController = exports.MediaController = Montage.create(Target, /** @lends MediaController# */ {
    /*-----------------------------------------------------------------------------
     MARK:   Constants
     -----------------------------------------------------------------------------*/
    /**
        @type {Property}
        @default {Number} 0
    */
    STOPPED: { enumerable: true, value: 0, writable: false },
    /**
        @type {Property}
        @default {Number} 1
    */
    PLAYING: { enumerable: true, value: 1, writable: false },
    /**
        @type {Property}
        @default {Number} 2
    */
    PAUSED:  { enumerable: true, value: 2, writable: false },
    /**
        @type {Property}
        @default {Number} 3
    */
    EMPTY:   { enumerable: true, value: 3, writable: false },
    /**
    @private
    */
    _TIMEUPDATE_FREQUENCY: { value: 0.25   },  // Don't refresh too often.
    /*-----------------------------------------------------------------------------
     MARK:   Properties
     -----------------------------------------------------------------------------*/
    /**
    @private
    */
    _mediaController: {
        value: null,
        enumerable: false
    },
    /**
        @type {Function}
        @default null
    */
    mediaController: {
        get : function() {
            return this._mediaController;
        },
        set : function(controller) {
            if (this._mediaController !== controller) {
                if (this._mediaController) {
                    this._removeControlEventHandlers();
                }
                this._mediaController = controller;
                this._installControlEventHandlers();
            }
        },
        enumerable: false
    },


    /*-----------------------------------------------------------------------------
     MARK:   Status & Attributes
     -----------------------------------------------------------------------------*/
    /**
    @private
    */
    _status: {
        enumerable: false,
        value: 3
    },
    /**
    @type {Function}
    @default {Number} 3
    */
    status: {
        enumerable: false,
        get: function() {
            return this._status;
        },
        set: function(status) {
            if (status !== this._status) {
                if (logger.isDebug) {
                    logger.debug("MediaController:status: " + status);
                }
                this._status = status;
                this._dispatchStateChangeEvent();
            }
        }
    },
    /**
    @private
    */
    _position: { value:null, enumerable:false },
    /**
    @type {Function}
    @default null
    */
    position: {
        set: function(time, shouldNotUpdate) {
            this._position = time;
            if (!shouldNotUpdate) {
                this.currentTime = time;
            }
        },
        get: function() {
            return this._position;
        }
    },
    /**
    @private
    */
    _duration: { value: null, enumerable:false },
    /**
        @type {Function}
        @default null
    */
    duration: {
        set: function(time) {
            if (isNaN(time)) {
                if (logger.isDebug) {
                    logger.debug("MediaController:setDuration: duration is not valid");
                }
                return;
            }
            if (logger.isDebug) {
                logger.debug("MediaController:setDuration: duration=" + time);
            }
            this._duration = time;
        },
        get: function() {
            return this._duration;
        }
    },
    /*-----------------------------------------------------------------------------
     MARK:   Media Player Commands
     -----------------------------------------------------------------------------*/
    /**
        @type {Property}
        @default {Boolean} true
    */
    autoplay: {
        enumerable: false,
        value: false
    },
    /**
    @function
    */
    play: {
        value: function() {
            if (logger.isDebug) {
                logger.debug("MediaController:play()");
            }
            this.mediaController.currentTime = 0;
            this.mediaController.play();
        }
    },
    /**
    @function
    */
    pause: {
        value: function() {
            if (logger.isDebug) {
                logger.debug("MediaController:pause()");
            }
            this.mediaController.pause();
        }
    },
    /**
    @function
    */
    unpause: {
        value: function() {
            if (logger.isDebug) {
                logger.debug("MediaController:unpause()");
            }
            this.mediaController.unpause();
        }
    },
    /**
    @function
    @returns {Boolean} !playing (true if it is now playing)
    */
    playPause: {
        value: function() {
            if (logger.isDebug) {
                logger.debug("MediaController:playPause");
            }

            var playing = (this.status === this.PLAYING);
            this.playbackRate = this.mediaController.defaultPlaybackRate;
            if (playing) {
                this.pause();
            } else {
                this.play();
            }
            return !playing;    // true if it is now playing
        }
    },
    /**
    @private
    */
    _playbackRate: {
        value: 1,
        enumerable: false
    },
    /**
    @type {Function}
    @default {Number} 1
    */
    playbackRate: {
        get: function() {
            return this._playbackRate;
        },
        set: function(playbackRate) {
            if (this._playbackRate !== playbackRate) {
                this._playbackRate = playbackRate;
                this.mediaController.playbackRate = this._playbackRate;
            }
        }
    },
    /**
    @private
    */
    _currentTime: {
        value: 0,
        enumerable: false
    },
    /**
    @private
    */
    _updateCurrentTime: {
        value: false,
        enumerable: false
    },
    /**
        @type {Function}
        @default {Number} 0
    */
    currentTime: {
        get: function() {
            return this.mediaController.currentTime;
        },
        set: function(currentTime) {
            try {
                if (isNaN(this.mediaController.duration)) {
                    logger.error("MediaController:set currentTime: duration is not valid");
                    return;
                }
                if (logger.isDebug) {
                    logger.debug("current time: " + this.mediaController.currentTime + ", new time: " + currentTime);
                }
                this.mediaController.currentTime = currentTime;
            }
            catch(err) {
                logger.error("MediaController:Exception in set currentTime" + this.mediaController.currentTime);
            }
        }
    },
    /**
    @function
    */
    rewind: {
        value: function() {
            if (this.status === this.PLAYING) {
                if (logger.isDebug) {
                    logger.debug("MediaController:rewind");
                }
                this.playbackRate = -4.0;
            }
        }
    },
    /**
    @function
    */
    fastForward: {
        value: function() {
            if (this.status === this.PLAYING) {
                if (logger.isDebug) {
                    logger.debug("MediaController:fastForward");
                }
                this.playbackRate = 4.0;
            }
        }
    },
    /**
    @function
    */
    stop: {
        value: function() {
            if (logger.isDebug) {
                logger.debug("MediaController:stop");
            }

            // Pause the playback
            if (this.status === this.PLAYING) {
                if (logger.isDebug) {
                    logger.debug("MediaController:stop while PLAYING: will pause");
                }
                this.pause();
            }

            // Reset the status
            this.status = this.STOPPED;
            this.position = 0;
        }
    },


    /**
    @function
    */
    reset: {
        value: function() {
            if (logger.isDebug) {
                logger.debug("MediaController:reset");
            }
            if (this.status !== this.STOPPED) {
                this.stop();
            }
        }
    },


    showPoster: {
        value: function() {
            if (this.posterSrc) {
                this.mediaElement.poster = this.posterSrc;
            } else {
                this.mediaElement.poster = null;
            }
        }
    },


/**
    @function
    */
    toggleRepeat: {
        value: function() {
            this.repeat = !this.repeat;
        }
    },
    /**
    @private
    */
    _repeat: {
        value: false,
        enumerable: false
    },
    /**
        @type {Function}
        @default {Boolean} false
    */
    repeat: {
        get: function() {
            return this._repeat;
        },

        set: function(repeat) {
            if (repeat !== this._repeat) {
                this._repeat = repeat;
                if (repeat) {
                    this.mediaElement.setAttribute("loop", "true");
                } else {
                    this.mediaElement.removeAttribute("loop");
                }
                this._dispatchStateChangeEvent();
            }
        }
    },
    /*-----------------------------------------------------------------------------
     MARK:   Volume Commands
     -----------------------------------------------------------------------------*/
    /**
        @type {Function}
        @returns {Number} this.mediaController.volume * 100
    */
    volume: {
        get: function() {
            return this.mediaController.volume * 100;
        },

        set: function(vol) {
            var volume = vol;
            if (typeof volume === 'undefined') {
                volume = 50;
            }
            else if (volume > 100) {
                volume = 100;
            }
            else if (volume < 0) {
                volume = 0;
            }
            this.mediaController.volume = volume / 100.0;
            this._dispatchStateChangeEvent();
        }
    },

    /**
    @function
    */
    volumeIncrease: {
        value: function() {
            this.volume += 10;
        }
    },

    /**
    @function
    */
    volumeDecrease: {
        value: function() {
            this.volume -= 10;
        }
    },

    /**
    @function
    */
    toggleMute: {
        value: function() {
            this.mute = !this.mute;
        }
    },
    /**
    @type {Function}
    */
    mute: {
        get: function() {
            return this.mediaController.muted;
        },
        set: function(muted) {
            if (muted !== this.mediaController.muted) {
                this.mediaController.muted = muted;
            }
        }
    },
    /*-----------------------------------------------------------------------------
     MARK:   Event Handlers
     -----------------------------------------------------------------------------*/
/**
    @function
    @returns itself
    */
    handleLoadedmetadata: {
        value: function() {
            if (logger.isDebug) {
                logger.debug("MediaController:handleLoadedmetadata: PLAYING=" + (this.status === this.PLAYING) + " duration=" + this.mediaController.duration);
            }
            if (isNaN(this.mediaController.duration)) {
                if (logger.isDebug) {
                    logger.debug("MediaController:handleLoadedmetadata: duration is not valid");
                }
                return;
            }
            this.duration = this.mediaController.duration;
            if (this.autoplay) {
                if (logger.isDebug) {
                    logger.debug("MediaController:handleLoadedmetadata: autoplay");
                }
                this.play();
            } else {
                this.status = this.STOPPED;
            }
        }
    },
    /**
    @private
    */
    _lastCurrentTime: {
        value: 0
    },
    /**
    @function
    */
    handleTimeupdate: {
        value: function() {
            if (this.status !== this.STOPPED) { // A last 'timeupdate' is sent after stop() which is unwanted because it restores the last position.
                var currentTime = this.mediaController.currentTime;
                //if (Math.abs(this._lastCurrentTime - currentTime) >= this._TIMEUPDATE_FREQUENCY) {
                //    this._lastCurrentTime = currentTime;
                    Object.getPropertyDescriptor(this, "position").set.call(this, currentTime, true);
                //}
            }
        }
    },

    /**
    @function
    */
    handlePlay: {
        value: function() {
            if (logger.isDebug) {
                logger.debug("MediaController:handlePlay");
            }
            this.status = this.PLAYING;
        }
    },
    /**
    @function
    */
    handlePlaying: {
        value: function() {
            if (logger.isDebug) {
                logger.debug("MediaController:handlePlaying: PLAYING");
            }
            this.status = this.PLAYING;
        }
    },
    /**
    @function
    */
    handlePause: {
        value: function() {
            if (this.status !== this.STOPPED) {
                if (logger.isDebug) {
                    logger.debug("MediaController:handlePause: PAUSED");
                }
                this.status = this.PAUSED;
            }
            else {
                if (logger.isDebug) {
                    logger.debug("MediaController:handlePause: STOPPED");
                }
            }
        }
    },
    /**
    @function
    */
    handleEnded: {
        value: function() {
            if (logger.isDebug) {
                logger.debug("MediaController:handleEnded");
            }
            // If the mediaElement is not in the paused=true state
            // then it won't fire a play event when you start playing again
            this.mediaController.pause();
            this.status = this.STOPPED;
        }
    },
    /**
    @function
    */
    handleAbort: {
        value: function() {
            if (logger.isDebug) {
                logger.debug("MediaController:handleAbort: STOPPED");
            }
            this.status = this.STOPPED;
        }
    },
    /**
    @function
    @param {Event} event TODO
    */
    handleError: {
        value: function(event) {
            if (logger.isDebug) {
                logger.debug("MediaController:handleError: STOPPED");
            }
            var error = event.target.error;

            this.status = this.STOPPED;

            if (error) {
                switch (error.code) {
                    case error.MEDIA_ERR_ABORTED:
                        console.error("You aborted the video playback.");
                        break;
                    case error.MEDIA_ERR_NETWORK:
                        console.error("A network error caused the video download to fail part-way.");
                        break;
                    case error.MEDIA_ERR_DECODE:
                        console.error("The video playback was aborted due to a corruption problem or because the video used features your browser did not support.");
                        break;
                    case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        if (this.mediaElement.src.length > 0) {
                            console.error("The video at " + this.mediaElement.src + " could not be loaded, either because the server or network failed or because the format is not supported.");
                        }
                        else {
                            console.error("No video has been selected.");
                        }
                        break;
                    default:
                        console.error("An unknown error occurred.");
                        break;
                }
            }
        }
    },
    /**
    @function
    */
    handleEmptied: {
        value: function() {
            if (logger.isDebug) {
                logger.debug("MediaController:handleEmptied: STOPPED");
            }
            this.status = this.STOPPED;
        }
    },
    
    /**
    @private
    */
    _dispatchStateChangeEvent: {
        value: function() {
            var stateEvent = window.document.createEvent("CustomEvent");
            stateEvent.initCustomEvent("mediaStateChange", true, true, null);
            this.dispatchEvent(stateEvent);
        }
    },
    
    /**
    @private
    */
    _installControlEventHandlers: {
        value: function() {
            var handleLoadedmetadata    = this.handleLoadedmetadata.bind(this),
                handleTimeupdate        = this.handleTimeupdate.bind(this),
                handlePlay              = this.handlePlay.bind(this),
                handlePlaying           = this.handlePlaying.bind(this),
                handlePause             = this.handlePause.bind(this),
                handleAbort             = this.handleAbort.bind(this),
                handleError             = this.handleError.bind(this),
                handleEmptied           = this.handleEmptied.bind(this),
                handleEnded             = this.handleEnded.bind(this);
                
            this.mediaController.addEventListener('loadedmetadata', handleLoadedmetadata, false);
            this.mediaController.addEventListener('timeupdate', handleTimeupdate, false);
            this.mediaController.addEventListener('play', handlePlay, false);
            this.mediaController.addEventListener('playing', handlePlaying, false);
            this.mediaController.addEventListener('pause', handlePause, false);
            this.mediaController.addEventListener('abort', handleAbort, false);
            this.mediaController.addEventListener('error', handleError, false);
            this.mediaController.addEventListener('emptied', handleEmptied, false);
            this.mediaController.addEventListener('ended', handleEnded, false);
            
            this._removeControlEventHandlers = function() {
                this.mediaController.removeEventListener('loadedmetadata', handleLoadedmetadata);
                this.mediaController.removeEventListener('timeupdate', handleTimeupdate);
                this.mediaController.removeEventListener('play', handlePlay);
                this.mediaController.removeEventListener('playing', handlePlaying);
                this.mediaController.removeEventListener('pause', handlePause);
                this.mediaController.removeEventListener('abort', handleAbort);
                this.mediaController.removeEventListener('error', handleError);
                this.mediaController.removeEventListener('emptied', handleEmptied);
                this.mediaController.removeEventListener('ended', handleEnded);
            }
        }
    },
    
    _removeControlEventHandlers: {
        value: function() {
        }
    }
    /*-----------------------------------------------------------------------------
     MARK:   Configuration
     -----------------------------------------------------------------------------*/

});
