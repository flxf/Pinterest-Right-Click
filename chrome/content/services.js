// We are breaking the semantics of pin what you target. When targeting
// certain images, most commonly thumbnails of a larger image, it's implied
// that the user wanted the original. Pinterest does this with video preview
// images on youtube, pinning the video instead.

pinterestrc.SiteServicesController = (function() {
  let PinterestService = {
    handle : function pinterestServiceHandle(aLocation, aTarget) {
      // Do nothing
    }
  };

  let YouTubeService = {
    handle : function youtubeServiceHandle(aLocation, aTarget) {
      if (aTarget instanceof HTMLImageElement) {
        let targetURI = makeURI(aTarget.src);
        let menuitem;
        let isVideo;

        // Determine if we're pinning a video thumbnail
        if (/^\/?vi\//.test(targetURI.path)) {
          menuitem = document.getElementById("pinterest-context-pinyoutube");
          isVideo = true;
        } else {
          menuitem = document.getElementById("pinterest-context-pinit");
          isVideo = false;
        }

        pinterestrc.MenuController.addMenuItem(
          menuitem,
          {
            media : makeURI(aTarget.src),
            is_video : isVideo
            // TODO: Do better than intentionally leave out the alt text
          });
      } else {
        // We assume there are no interesting background images on YouTube and
        // instead give the option to pin the current video if one exists.

        let locationURI = makeURI(aLocation).QueryInterface(Ci.nsIURL);
        if (/^\/watch/.test(locationURI.filePath)) {
          // User is on a YouTube video page, extract the video id from the URL
          // so that the video can be pinned.
          let queryParams = locationURI.query.split("&");
          for (let i = 0, len = queryParams.length; i < len; i++) {
            let [ key, value ] = queryParams[i].split("=");
            if (key == "v") {
              // Construct the thumbnail URL
              //
              // NOTE: This is obviously sketchy. For performance reasons, I
              // don't want to make an API request so I'll live with it.
              let thumbnailURI = makeURI("http://img.youtube.com/vi/" + value + "/0.jpg");

              pinterestrc.MenuController.addMenuItem(
                document.getElementById("pinterest-context-pinyoutube"),
                {
                  media : thumbnailURI,
                  alt : window.content.document.title,
                  is_video : true
                });
              break;
            }
          }
        }
      }
    }
  };

  let FacebookService = {
    handle : function facebookServiceHandler(aLocation, aTarget) {
      let targetURI;
      let targetDict = {};

      if (aTarget instanceof HTMLImageElement) {
        targetDict.media = makeURI(aTarget.src);
        targetDict.alt = aTarget.alt;
      } else {
        let targetSource =
          pinterestrc.PinterestContext.findBackgroundImage(aTarget);
        if (!targetSource) {
          return;
        }
        targetDict.media = makeURI(targetSource);
      }

      // Linking to Facebook won't lead back to the pin, so we'll avoid it by
      // linking right back to the image. Awful, I know.
      targetDict.url = targetDict.media;

      // Recognize all Facebook images as foreground images
      pinterestrc.MenuController.addMenuItem(
        document.getElementById("pinterest-context-pinit"),
        targetDict);
    }
  };

  let DefaultService = {
    handle : function defaultServiceHandler(aLocation, aTarget) {
      if (aTarget instanceof HTMLImageElement) {
        pinterestrc.MenuController.addMenuItem(
          document.getElementById("pinterest-context-pinit"),
          {
            media : makeURI(aTarget.src),
            alt : aTarget.alt
          });
      } else {
        let bgImageSrc = pinterestrc.PinterestContext.findBackgroundImage(aTarget);

        if (bgImageSrc) {
          pinterestrc.MenuController.addMenuItem(
            document.getElementById("pinterest-context-pinbgimage"),
            {
              media : makeURI(bgImageSrc)
            });
        }
      }
    }
  };

  let ServicesMap = [
    { k : /^https?:\/\/(www\.)?pinterest.com/, v : PinterestService },
    { k : /^https?:\/\/((www\.)|(img\.))?youtube.com/, v : YouTubeService },
    { k : /^https?:\/\/(www\.)?facebook.com/, v : FacebookService }
  ];

  return {
    handleLocation : function handleLocation(aLocation, aTarget) {
      let locationString = aLocation.toString();
      for (let i = 0, len = ServicesMap.length; i < len; i++) {
        if (ServicesMap[i].k.test(locationString)) {
          ServicesMap[i].v.handle(aLocation, aTarget);
          return;
        }
      }

      DefaultService.handle(aLocation, aTarget);
    }
  };
})();
