/* global angular */
angular.module('afkl.lazyImage', [])
    .service('afklSrcSetService', ['$window', function($window) {
        'use strict';

        /**
         * For other applications wanting the srccset/best image approach it is possible to use this module only
         * Loosely based on https://raw.github.com/borismus/srcset-polyfill/master/js/srcset-info.js
         */
        var INT_REGEXP = /^[0-9]+$/;

        // SRCSET IMG OBJECT
        function ImageInfo(options) {
            this.src = options.src;
            this.w = options.w || Infinity;
            this.h = options.h || Infinity;
            this.x = options.x || 1;
        }

        /**
         * Parse srcset rules
         * @param  {string} descString Containing all srcset rules
         * @return {object}            Srcset rules
         */
        var _parseDescriptors = function (descString) {

            var descriptors = descString.split(/\s/);
            var out = {};

            for (var i = 0, l = descriptors.length; i < l; i++) {

                var desc = descriptors[i];

                if (desc.length > 0) {

                    var lastChar = desc.slice(-1);
                    var value = desc.substring(0, desc.length - 1);
                    var intVal = parseInt(value, 10);
                    var floatVal = parseFloat(value);

                    if (value.match(INT_REGEXP) && lastChar === 'w') {
                        out[lastChar] = intVal;
                    } else if (value.match(INT_REGEXP) && lastChar === 'h') {
                        out[lastChar] = intVal;
                    } else if (!isNaN(floatVal) && lastChar === 'x') {
                        out[lastChar] = floatVal;
                    } 

                }
            }

            return out;

        };

        /**
         * Returns best candidate under given circumstances
         * @param  {object} images     Candidate image
         * @param  {function} criteriaFn Rule
         * @return {object}            Returns best candidate under given criteria
         */
        var _getBestCandidateIf = function (images, criteriaFn) {

            var bestCandidate = images[0];

            for (var i = 0, l = images.length; i < l; i++) {
                var candidate = images[i];
                if (criteriaFn(candidate, bestCandidate)) {
                    bestCandidate = candidate;
                }
            }

            return bestCandidate;

        };

        /**
         * Remove candidate under given circumstances
         * @param  {object} images     Candidate image
         * @param  {function} criteriaFn Rule
         * @return {object}            Removes images from global image collection (candidates)
         */
        var _removeCandidatesIf = function (images, criteriaFn) {

            for (var i = images.length - 1; i >= 0; i--) {
                var candidate = images[i];
                if (criteriaFn(candidate)) {
                    images.splice(i, 1); // remove it
                }
            }

            return images;

        };
      
        /**
        * Direct implementation of "processing the image candidates":
        * http://www.whatwg.org/specs/web-apps/current-work/multipage/embedded-content-1.html#processing-the-image-candidates
        *
        * @param  {array} imageCandidates (required)
        * @param  {object} view (optional)
        * @returns {ImageInfo} The best image of the possible candidates.
        */
        var getBestImage = function (imageCandidates, view) {

            if (!imageCandidates) { return; }
            if (!view) {
                view = {
                    'w' : $window.innerWidth || document.documentElement.clientWidth,
                    'h' : $window.innerHeight || document.documentElement.clientHeight,
                    'x' : $window.devicePixelRatio || 1
                };
            }

            var images = imageCandidates.slice(0);

            /* LARGEST */
            // Width
            var largestWidth = _getBestCandidateIf(images, function (a, b) { return a.w > b.w; });
            // Less than client width.
            _removeCandidatesIf(images, (function () { return function (a) { return a.w < view.w; }; })(this));
            // If none are left, keep the one with largest width.
            if (images.length === 0) { images = [largestWidth]; }


            // Height
            var largestHeight = _getBestCandidateIf(images, function (a, b) { return a.h > b.h; });
            // Less than client height.
            _removeCandidatesIf(images, (function () { return function (a) { return a.h < view.h; }; })(this));
            // If none are left, keep one with largest height.
            if (images.length === 0) { images = [largestHeight]; }

            // Pixel density.
            var largestPxDensity = _getBestCandidateIf(images, function (a, b) { return a.x > b.x; });
            // Remove all candidates with pxdensity less than client pxdensity.
            _removeCandidatesIf(images, (function () { return function (a) { return a.x < view.x; }; })(this));
            // If none are left, keep one with largest pixel density.
            if (images.length === 0) { images = [largestPxDensity]; }


            /* SMALLEST */
            // Width
            var smallestWidth = _getBestCandidateIf(images, function (a, b) { return a.w < b.w; });
            // Remove all candidates with width greater than it.
            _removeCandidatesIf(images, function (a) { return a.w > smallestWidth.w; });

            // Height
            var smallestHeight = _getBestCandidateIf(images, function (a, b) { return a.h < b.h; });
            // Remove all candidates with height greater than it.
            _removeCandidatesIf(images, function (a) { return a.h > smallestHeight.h; });

            // Pixel density
            var smallestPxDensity = _getBestCandidateIf(images, function (a, b) { return a.x < b.x; });
            // Remove all candidates with pixel density less than smallest px density.
            _removeCandidatesIf(images, function (a) { return a.x > smallestPxDensity.x; });

            return images[0];

        };



        // options {src: null/string, srcset: string}
        // options.src    normal url or null
        // options.srcset 997-s.jpg 480w, 997-m.jpg 768w, 997-xl.jpg 1x
        var getSrcset = function (options) {

            var imageCandidates = [];

            var srcValue = options.src;
            var srcsetValue = options.srcset;

            if (!srcsetValue) { return; }

            /* PUSH CANDIDATE [{src: _, x: _, w: _, h:_}, ...] */
            var _addCandidate = function (img) {

                for (var j = 0, ln = imageCandidates.length; j < ln; j++) {
                    var existingCandidate = imageCandidates[j];

                    // DUPLICATE
                    if (existingCandidate.x === img.x &&
                        existingCandidate.w === img.w &&
                        existingCandidate.h === img.h) { return; }
                }

                imageCandidates.push(img);

            };


            var _parse = function () {

                var input = srcsetValue,
                position = 0,
                rawCandidates = [],
                url,
                descriptors;

                while (input !== '') {

                    while (input.charAt(0) === ' ') {
                        input = input.slice(1);
                    }

                    position = input.indexOf(' ');

                    if (position !== -1) {

                        url = input.slice(0, position);

                        // if (url === '') { break; }

                        input = input.slice(position + 1);

                        position = input.indexOf(',');

                        if (position === -1) {
                            descriptors = input;
                            input = '';
                        } else {
                            descriptors =  input.slice(0, position);
                            input = input.slice(position + 1);
                        }

                        rawCandidates.push({
                            url: url,
                            descriptors: descriptors
                        });

                    } else {

                        rawCandidates.push({
                            url: input,
                            descriptors: ''
                        });
                        input = '';
                    }

                }

                // FROM RAW CANDIDATES PUSH IMAGES TO COMPLETE SET
                for (var i = 0, l = rawCandidates.length; i < l; i++) {

                    var candidate = rawCandidates[i],
                    desc = _parseDescriptors(candidate.descriptors);

                    _addCandidate(new ImageInfo({
                        src: candidate.url,
                        x: desc.x,
                        w: desc.w,
                        h: desc.h
                    }));

                }

                if (srcValue) {
                    _addCandidate(new ImageInfo({src: srcValue}));
                }

            };

            _parse();


            // Return best available image for current view based on our list of candidates
            var bestImage = getBestImage(imageCandidates);

            /**
             * Object returning best match at moment, and total collection of candidates (so 'image' API can be used by consumer)
             * @type {Object}
             */
            var object = {
                'best': bestImage,              // IMAGE INFORMATION WHICH FITS BEST WHEN API IS REQUESTED
                'candidates': imageCandidates   // ALL IMAGE CANDIDATES BY GIVEN SRCSET ATTRIBUTES
            };

            // empty collection
            imageCandidates = null;

            // pass best match and candidates
            return object;

        };


        /**
         * PUBLIC API
         */
        return {
            get: getSrcset,        // RETURNS BEST IMAGE AND IMAGE CANDIDATES
            image: getBestImage    // RETURNS BEST IMAGE WITH GIVEN CANDIDATES
        };


    }])
    .directive('afklImageContainer', function () {
        'use strict';

        return {
            restrict: 'A',
            link: function (scope, element) {
                element.data('afklImageContainer', element);
            }
        };
    })
    .directive('afklLazyImage', ['$window', '$timeout', 'afklSrcSetService', function ($window, $timeout, srcSetService) {
        'use strict';

        // Use srcSetService to find out our best available image
        var bestImage = function (images) {
            var image = srcSetService.get({srcset: images});
            var sourceUrl;
            if (image) {
                sourceUrl = image.best.src;
            }
            return sourceUrl;
        };

        return {
            restrict: 'A',
            link: function (scope, element, attrs) {

                // CONFIGURATION VARS
                var $container = element.inheritedData('afklImageContainer');
                if (!$container) {
                    $container = angular.element(attrs.afklLazyImageContainer || $window);
                }

                var loaded = false;
                var timeout;

                var images = attrs.afklLazyImage; // srcset attributes
                var options = attrs.afklLazyImageOptions ? angular.fromJson(attrs.afklLazyImageOptions) : {}; // options (background, offset)

                var img; // Angular element to image which will be placed
                var currentImage = null; // current image url
                var offset = options.offset ? options.offset : 50; // default offset
                var LOADING = 'afkl-lazy-image-loading';

                // What is position of our container (assumed it is not hidden) 
                var offsetElement;

                // Begin with offset and update on resize
                var _calculateOffset = function () {
                    offsetElement = element.offset().top;
                };

                // Update url of our image
                var _setImage = function () {
                    if (options.background) {
                        element[0].style.backgroundImage = 'url("' + currentImage +'")';
                    } else {
                        img[0].src = currentImage;
                    }
                };

                // Append image to DOM
                var _placeImage = function () {

                    loaded = true;
                    // What is my best image available
                    currentImage = bestImage(images);

                    if (currentImage) {
                        // we have to make an image if background is false (default)
                        if (!options.background) {
                            element.addClass(LOADING);
                            img = angular.element('<img alt="" class="afkl-lazy-image" src=""/>');
                            // remove loading class when image is acually loaded
                            img.one('load', _loaded);
                            element.append(img);
                        } else {
                            element[0].style.backgroundImage = 'url("' + currentImage +'")';
                        }
                        // set correct src/url
                        _setImage();
                    }

                    // Element is added to dom, no need to listen to scroll anymore
                    $container.off('scroll', _onScroll);

                };

                // Check on resize if actually a new image is best fit, if so then apply it
                var _checkIfNewImage = function () {
                    if (loaded) {
                        var newImage = bestImage(images);
                        if (newImage !== currentImage) {
                            // update current url
                            currentImage = newImage;
                            // update image url
                            _setImage();
                        }
                    } else {
                        _calculateOffset();
                    }
                };

                // First update our begin offset
                _checkIfNewImage();

                var _loaded = function () {
                    element.removeClass(LOADING);
                };


                // EVENT: SCROLL. Check if our container is for first time in our view or not
                var _onScroll = function () {
                    // Config vars
                    var remaining, shouldLoad, windowBottom;

                    var height = $container.innerHeight();

                    /*var scroll = "scrollY" in $window[0] ? 
                        $window[0].scrollY 
                        : document.documentElement.scrollTop;*/
                    // https://developer.mozilla.org/en-US/docs/Web/API/window.scrollY
                    var scroll = $container.scrollTop();

                    windowBottom = height + scroll;
                    remaining = element.offset().top - windowBottom;

                    // Is our top of our image container in bottom of our viewport?
                    shouldLoad = remaining <= offset;

                    // Append image first time when it comes into our view, after that only resizing can have influence
                    if (shouldLoad && !loaded) {

                        _placeImage();

                    }

                };


                // EVENT: RESIZE. 
                var _onResize = function () {
                    $timeout.cancel(timeout);
                    timeout = $timeout(_checkIfNewImage, 300);
                };

                // Remove events for total destroy
                var _eventsOff = function() {

                    $timeout.cancel(timeout);

                    $container.off('scroll', _onScroll);
                    $container.off('resize', _onResize);

                    // remove image being placed
                    if (img) {
                        img.remove();
                    }

                    img = timeout = offsetElement = currentImage = undefined;
                };



                // Set events for scrolling and resizing
                $container.on('scroll', _onScroll);
                $container.on('resize', _onResize);

                // Image should be directly placed
                if (options.nolazy) {
                    _placeImage();
                }

                // Remove all events when destroy takes place
                scope.$on('$destroy', function () {
                    return _eventsOff();
                });

                return _onScroll();

            }
        };

}]);
