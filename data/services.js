// We are breaking the semantics of pin what you target. When targeting
// certain images, most commonly thumbnails of a larger image, it's implied
// that the user wanted the original. Pinterest does this with video preview
// images on youtube, pinning the video instead.

var pinterestrc = (pinterestrc) ? pinterestrc : {};

if (!pinterestrc.SiteServicesController) {
  function findBackgroundImage(aTarget) {
    // Bubble up DOM tree looking for a background image
    while (aTarget) {
      if (aTarget.nodeType == Node.ELEMENT_NODE) {
        // Check to find each successive ancestor for a background image
        let bgImageURL = aTarget.ownerDocument.defaultView
          .getComputedStyle(aTarget, "").getPropertyCSSValue("background-image");

        // Computed background may yield any number of URIs. If we've found 1,
        // then we are successful. If we find multiple, we are unable to decide
        // and we'll give up. If we find none, keep looking.
        let numBgFound = 0;
        if (bgImageURL instanceof CSSPrimitiveValue &&
            bgImageURL.primitiveType == CSSPrimitiveValue.CSS_URI) {
          numBgFound = 1;
        } else if (bgImageURL instanceof CSSValueList) {
          numBgFound = bgImageURL.length;
          if (bgImageURL.length == 1) {
            bgImageURL = bgImageURL[0];
            if (bgImageURL.primitiveType != CSSPrimitiveValue.CSS_URI) {
              numBgFound = 0;
            }
          }
        }

        if (numBgFound > 1) {
          return null;
        } else if (numBgFound == 1) {
          bgImageURL = bgImageURL.getStringValue();
          return bgImageURL;
        }
      }

      aTarget = aTarget.parentNode;
    }

    // Nothing found
    return null;
  }

  pinterestrc.SiteServicesController = (function() {
    let PinterestService = {
      handle : function pinterestServiceHandle(aLocation, aTarget) {
        // Do nothing
      }
    };

    let YouTubeService = {
      handle : function youtubeServiceHandle(aLocation, aTarget) {
        if (aTarget instanceof HTMLImageElement) {
          // Determine if we're pinning a video thumbnail
          let targetAnchor = document.createElement('a');
          targetAnchor.href = aTarget.src;

          let label;
          if (/^\/?vi\//.test(targetAnchor.pathname)) {
            label = 'pin_youtube';
          } else {
            label = 'pin_image';
          }

          return {
            label : label,
            media : aTarget.src
          };
        } else {
          // We assume there are no interesting background images on YouTube and
          // instead give the option to pin the current video if one exists.

          let locationAnchor = document.createElement('a');
          locationAnchor.href = aLocation;
          if (/^\/watch/.test(locationAnchor.pathname)) {
            // User is on a YouTube video page, extract the video id from the URL
            // so that the video can be pinned.
            let queryParams = locationAnchor.search.substr(1).split("&");
            for (let i = 0, len = queryParams.length; i < len; i++) {
              let [ key, value ] = queryParams[i].split("=");
              if (key == "v") {
                // NOTE: This will break if they ever update their thumbnail
                // URLs. We could use their API to guarantee URL correctness,
                // but we want to avoid making a request for performance
                // reasons. We'll live with this brittleness.
                let thumbnailSrc = "http://img.youtube.com/vi/" + value + "/0.jpg";

                return {
                  label : 'pin_youtube',
                  media : thumbnailSrc,
                  alt : window.content.document.title
                };
              }
            }
          }

          return false;
        }
      }
    };

    let FacebookService = {
      handle : function facebookServiceHandler(aLocation, aTarget) {
        let targetURI;
        let targetDict = {};

        let foundTarget = false;
        if (aTarget instanceof HTMLImageElement) {
          targetDict.media = aTarget.src;
          //targetDict.alt = aTarget.alt;
          foundTarget = true;
        }

        if (!foundTarget) {
          if (aTarget.classList.contains("uiPhotoThumb") ||
              aTarget.classList.contains("uiScaledImageContainer")) {
            targetDict.media = aTarget.firstChild.src;
            foundTarget = true;
          }
        }

        if (!foundTarget) {
          let targetSource = findBackgroundImage(aTarget);
          if (targetSource) {
            targetDict.media = targetSource;
            foundTarget = true;
          }
        }

        if (foundTarget) {
          // Link pin back to the image itself. This setting will be overwritten
          // by the Facebook rewrite rules for Facebook photos. However, doing
          // this now covers pinning other images on Facebook.
          targetDict.url = targetDict.media;

          // Recognize all Facebook images as foreground images
          targetDict.label = 'pin_image';
          return targetDict;
        }

        return false;
      }
    };

    let VimeoService = {
      handle : function vimeoServiceHandler(aLocation, aTarget) {
        if (aTarget instanceof HTMLImageElement) {
          // Determine if we're pinning a video thumbnail
          let targetAnchor = document.createElement('a');
          targetAnchor.href = aTarget.src;

          let label;
          if (/^\/?ts\//.test(targetAnchor.pathname)) {
            label = 'pin_vimeo';
          } else {
            label = 'pin_image';
          }

          return {
            label : label,
            media : aTarget.src
          };
        } else {
          let featuredPlayer = aTarget.querySelector('#featured_player');

          if (featuredPlayer) {
            let thumbnailSrc = featuredPlayer.querySelector('div.vimeo_holder').style.backgroundImage;
            thumbnailSrc = thumbnailSrc.slice(5, -2);

            let flashvars = featuredPlayer.querySelector('param[name=flashvars]');
            let clipId = null;
            if (flashvars) {
              flashvars.getAttribute('value').split('&').some(function(pair) {
                let [ k, v ] = pair.split('=');
                if (k == 'clip_id') {
                  clipId = v;
                  return true;
                }
                return false;
              });
            }

            return {
              label : 'pin_vimeo',
              media : thumbnailSrc,
              url : 'http://vimeo.com/' + clipId
            };
          }
          return false;
        }
      }
    };

    let DefaultService = {
      handle : function defaultServiceHandler(aLocation, aTarget) {
        if (aTarget instanceof HTMLImageElement) {
          return {
            label : 'pin_image',
            media : aTarget.src,
            alt : aTarget.alt
          };
        } else {
          let bgImageSrc = findBackgroundImage(aTarget);
          if (bgImageSrc) {
            return {
              label : 'pin_background',
              media : bgImageSrc
            };
          }
        }

        return false;
      }
    };

    let ServicesMap = [
      { k : /^https?:\/\/(www\.)?pinterest.com/, v : PinterestService },
      { k : /^https?:\/\/((www\.)|(img\.))?youtube.com/, v : YouTubeService },
      { k : /^https?:\/\/(www\.)?facebook.com/, v : FacebookService },
      { k : /^https?:\/\/(www\.)?vimeo.com/, v : VimeoService }
    ];

    return {
      lastData : null,

      handleLocation : function handleLocation(aLocation, aTarget) {
        let locationString = aLocation.toString();
        for (let i = 0, len = ServicesMap.length; i < len; i++) {
          if (ServicesMap[i].k.test(locationString)) {
            this.lastData = ServicesMap[i].v.handle(aLocation, aTarget);
            return !!this.lastData;
          }
        }

        this.lastData = DefaultService.handle(aLocation, aTarget);
        return !!this.lastData;
      }
    };
  })();
}

self.on("context", function(aTarget) {
  let doc = aTarget.ownerDocument;
  let currentLocation = doc.location;
  let ssc = pinterestrc.SiteServicesController;
  let pinnable = ssc.handleLocation(currentLocation, aTarget);

  if (pinnable) {
    if (ssc.lastData.url === undefined) {
      ssc.lastData.url = doc.location.href;
    }

    // Not sure what Pinterest uses the title for, but let's give it to them
    let pageTitle = doc.title;
    if (pageTitle) {
      ssc.lastData.title = pageTitle;
    }

    self.postMessage({ type : 'label', label : ssc.lastData.label });
  }
  return pinnable;
});

self.on("click", function(aTarget) {
  pinterestrc.SiteServicesController.lastData.type = 'pin';
  self.postMessage(pinterestrc.SiteServicesController.lastData);
});
