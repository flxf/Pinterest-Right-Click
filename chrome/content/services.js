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
        //
        // Note: We're relying on urls to be generated a certain way so this is
        // rather sketchy.
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
            media : aTarget.src,
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
              let thumbnailURL =
                "http://img.youtube.com/vi/" + value + "/0.jpg";

              pinterestrc.MenuController.addMenuItem(
                document.getElementById("pinterest-context-pinyoutube"),
                {
                  media : thumbnailURL,
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
      let menuitem;
      let targetURI;
      let targetDict = {};

      if (aTarget instanceof HTMLImageElement) {
        targetDict.media = aTarget.src;
        targetDict.alt = aTarget.alt;
      } else {
        targetDict.media = pinterestrc.PinterestContext.findBackgroundImage(aTarget);
        if (!targetDict.media) {
          return;
        }
      }

      let targetURI = makeURI(targetDict.media);

      // For any Facebook photo, only pin the full-size version
      if (/fbcdn-sphotos.a.akamaihd.net/.test(targetURI.host)) {
        // A static image URL looks something like:
        // fbcdn.blah.akamai.net/<cdn_node>/<resize_params>/<fileid>_<filesize>.jpg
        //
        // We'll remove any resize_params if they exist and specify the filesize to
        // be the largest size guaranteed to be available in an upload.
        let pathPieces = targetURI.path.split("/");
        let cdnNode = pathPieces[1];
        let fileName = pathPieces[pathPieces.length - 1];

        // Change file size
        fileName.replace(/_.\.jpg$/i, "_n.jpg");

        // Discard resize params
        // TODO: Have a safer fallback
        targetURI.path = "/" + cdnNode + "/" + fileName;

        targetDict.media = targetURI.resolve("");
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
            media : aTarget.src,
            alt : aTarget.alt
          });
      } else {
        let bgImageSrc = pinterestrc.PinterestContext.findBackgroundImage(aTarget);

        if (bgImageSrc) {
          pinterestrc.MenuController.addMenuItem(
            document.getElementById("pinterest-context-pinbgimage"),
            {
              media : bgImageSrc
            });
        }
      }
    }
  };

  let ServicesMap = [
    { k : /^https?:\/\/(www\.)?pinterest.com/, v : PinterestService },
    { k : /^https?:\/\/((www\.)|(img\.))?youtube.com/, v : YouTubeService },
    { k : /^https?:\/\/[^\.]+\.ytimg.com/, v : YouTubeService },
    { k : /^https?:\/\/(www\.)?facebook.com/, v : FacebookService },
    { k : /^https?:\/\/fbcdn-sphotos.a.akamaihd.net/, v : FacebookService },
    // Default
    { k : /./, v : DefaultService }
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

      // This should never happen
    }
  };
})();