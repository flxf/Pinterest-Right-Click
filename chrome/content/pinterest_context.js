var pinterestrc = (pinterestrc) ? pinterestrc : {};

pinterestrc.MenuController = (function() {
  /**
   * Keeps track of displayed context menu items and their event handlers so
   * that they can be cleaned up when the context menu gets hidden.
   */
  let activeMenuHandlers = [];

  /**
   * Show and create handler for a pinning option represented by aMenuItem
   */
  let addMenuItem = function addMenuItem(aMenuItem, aTargetSource, aAltText) {
    let targetURI = makeURI(aTargetSource);
    // TODO: Investigate whether we can get something for non-http
    if (!targetURI.schemeIs("http") && !targetURI.schemeIs("https")) {
      return false;
    }

    aMenuItem.hidden = false;
    let menuItemListener = function() {
      pinterestrc.PinterestContext.pinTarget(aTargetSource, aAltText);
    };
    aMenuItem.addEventListener("command", menuItemListener);

    activeMenuHandlers.push({
      item : aMenuItem,
      listener : menuItemListener
    });
    aMenuItem = null;
    return true;
  };

  /**
   * Hides pinning options by default and clean up listeners when popup closes
   */
  let unloadMenuItems = function unloadMenuItems() {
    for (let i = 0, len = activeMenuHandlers.length; i < len; i++) {
      let menuHandler = activeMenuHandlers[i];
      menuHandler.item.hidden = true;
      menuHandler.item.removeEventListener("command", menuHandler.listener);
    }
    activeMenuHandlers = [];
  };

  return {
    addMenuItem : addMenuItem,
    unloadMenuItems : unloadMenuItems
  };
})();

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

        // Determine if we're pinning a video thumbnail
        //
        // Note: We're relying on urls to be generated a certain way so this is
        // rather sketchy.
        if (/^\/?vi\//.test(targetURI.path)) {
          menuitem = document.getElementById("pinterest-context-pinyoutube");
        } else {
          menuitem = document.getElementById("pinterest-context-pinit");
        }

        pinterestrc.MenuController.addMenuItem(
          menuitem, aTarget.src, aTarget.alt);
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
                thumbnailURL,
                window.content.document.title);
              break;
            }
          }
        }
      }
    }
  };

  let DefaultService = {
    handle : function defaultServiceHandler(aLocation, aTarget) {
      if (aTarget instanceof HTMLImageElement) {
        pinterestrc.MenuController.addMenuItem(
          document.getElementById("pinterest-context-pinit"),
          aTarget.src,
          aTarget.alt);
      } else {
        let bgImageSrc = pinterestrc.PinterestContext.findBackgroundImage(aTarget);
        if (bgImageSrc) {
          pinterestrc.MenuController.addMenuItem(
            document.getElementById("pinterest-context-pinbgimage"),
            bgImageSrc);
        }
      }
    }
  };

  let ServicesMap = [
    { k : /^https?:\/\/(www\.)?pinterest.com/, v : PinterestService },
    { k : /^https?:\/\/((www\.)|(img\.))?youtube.com/, v : YouTubeService },
    { k : /^https?:\/\/[^\.]+\.ytimg.com/, v : YouTubeService },
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

pinterestrc.PinterestContext = {
  /**
   * Handles the pinning action, fetching parameters from target information
   */
  pinTarget : function pinTarget(aMediaURI, aAltText) {
    let createURI = makeURI("http://pinterest.com/pin/create/bookmarklet/")
      .QueryInterface(Ci.nsIURL);
    let mediaURI = makeURI(aMediaURI).QueryInterface(Ci.nsIURL);

    let pinParams = {};

    // Set the media of the pin
    //
    // We are breaking the semantics of pin what you target. When targeting
    // certain images, most commonly thumbnails of a larger image, it's implied
    // that the user wanted the original. Pinterest does this with video preview
    // images on youtube, pinning the video instead.
    //
    // Warning: This code sucks because it relies on us to create edge-cases
    // whenever we find them.

    // For any static Facebook image only pin the full-size version
    if (/fbcdn-sphotos.a.akamaihd.net/.test(mediaURI.host)) {
      let mediaPath = mediaURI.path;
      if (mediaPath[0] == '/') {
        mediaPath = mediaPath.substr(1);
      }

      // A static image URL looks something like:
      // fbcdn.blah.akamai.net/<cdn_node>/<resize_params>/<fileid>_<filesize>.jpg
      //
      // We'll remove any resize_params if they exist and specify the filesize to
      // be the largest size guaranteed to be available in an upload.
      let pathPieces = mediaPath.split("/");

      // Change file size
      let fileName = pathPieces[pathPieces.length - 1];
      fileName.replace(/_.\.jpg$/i, "_n.jpg");
      pathPieces[pathPieces.length - 1] = fileName;

      // Remove resize params
      let impliedMediaURI = mediaURI.clone();
      if (pathPieces.length == 2) {
        impliedMediaURI.path = "/" + pathPieces.join("/");
      } else if (pathPieces.length == 3) {
        impliedMediaURI.path = "/" + pathPieces[0] + "/" + pathPieces[2];
      } else {
        // TODO: Report error of some sort, bail for now
        return;
      }

      pinParams.media = encodeURIComponent(impliedMediaURI.resolve(""));
    } else {
      pinParams.media = encodeURIComponent(mediaURI.resolve(""));
    }

    // Set the page linked to the pin.
    //
    // When pinning images off dynamic sites, we won't want to link to the current
    // URL because users directed from the pin won't see the same image.
    //
    // Warning: This code sucks because it relies on us to create edge-cases
    // whenever we find them.
    let currentLocation = window.content.location;
    if (/(www\.)?facebook.com/.test(currentLocation.host)) {
      pinParams.url = encodeURIComponent(pinParams.media);
    } else {
      pinParams.url = encodeURIComponent(currentLocation.href);
    }

    // Set the alt test of the pin.
    if (aAltText !== undefined && aAltText) {
      pinParams.alt = encodeURIComponent(aAltText);
    }

    // Not sure what Pinterest uses the title for, but let's give it to them
    let pageTitle = window.content.document.title;
    if (pageTitle) {
      pinParams.title = encodeURIComponent(pageTitle);
    }

    // TODO: We don't yet support video pins
    pinParams.is_video = "false";

    // Convert params to query string and append it to create uri
    let paramList = [];
    for (let key in pinParams) {
      paramList.push(key + "=" + pinParams[key]);
    }
    let queryString = "?" + paramList.join("&");
    createURI.query = queryString;

    // Open the create pin dialog
    let createDialogAttributes =
      "status=no,resizable=no,scrollbars=yes,personalbar=no,directories=no," +
      "location=yes,toolbar=no,menubar=no,width=632,height=270,left=0,top=0";
    window.open(createURI.resolve(""), "", createDialogAttributes);
  },

  /**
   * Returns the lowest (DOM-wise) background image for the given target
   *
   * @returns a URL string or null
   */
  findBackgroundImage : function findBackgroundImage(aTarget) {
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
};


/**
 * Initializes required event handlers
 */
window.addEventListener("load", function() {
  /**
   * Configures the context menu to show pinning options when it makes sense
   */
  function onPopupShowing(aEvent) {
    let target = document.popupNode;
    let currentLocation = window.content.location;
    pinterestrc.SiteServicesController.handleLocation(currentLocation, target);
  }

  // Avoid circular-reference created by closure
  (function() {
    let menu = document.getElementById("contentAreaContextMenu");
    menu.addEventListener("popupshowing", onPopupShowing, false);
    menu.addEventListener(
      "popuphiding", pinterestrc.MenuController.unloadMenuItems, false);
  })();
}, false);
