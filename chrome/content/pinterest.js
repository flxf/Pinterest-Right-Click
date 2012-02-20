Components.utils.import("chrome://pinterest-modules/content/Uri.jsm");

let PinterestAddon = {
  menuItemListener : null,
  pinBgItemListener : null,

  /**
   * Handles the pinning action, fetching parameters from target information
   */
  pinTarget : function pinTarget(aMediaURI, aAltText) {
    let createURI = new Uri("http://pinterest.com/pin/create/bookmarklet/");
    let mediaURI = new Uri(aMediaURI);

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
    if (/fbcdn-sphotos.a.akamaihd.net/.test(mediaURI.host())) {
      let mediaPath = mediaURI.path();
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
      let impliedMediaURI;
      if (pathPieces.length == 2) {
        impliedMediaURI =
          mediaURI.clone().setPath("/" + pathPieces.join("/"));
      } else if (pathPieces.length == 3) {
        impliedMediaURI =
          mediaURI.clone().setPath("/" + pathPieces[0] + "/" + pathPieces[2]);
      } else {
        // TODO: Report error of some sort, bail for now
        return;
      }

      createURI.addQueryParam("media",
        encodeURIComponent(impliedMediaURI.toString()));
    } else {
      createURI.addQueryParam("media", encodeURIComponent(mediaURI.toString()));
    }

    // Set the page linked to the pin.
    //
    // When pinning images off dynamic sites, we won't want to link to the current
    // URL because users directed from the pin won't see the same image.
    //
    // Warning: This code sucks because it relies on us to create edge-cases
    // whenever we find them.
    let currentURI = new Uri(window.content.location.toString());
    if (/(www\.)?facebook.com/.test(currentURI.host())) {
      createURI.addQueryParam("url",
        encodeURIComponent(createURI.getQueryParamValue("media")));
    } else {
      createURI.addQueryParam("url", encodeURIComponent(currentURI.toString()));
    }

    // Set the alt test of the pin.
    if (aAltText !== undefined && aAltText) {
      createURI.addQueryParam("alt", encodeURIComponent(aAltText));
    }

    // Not sure what Pinterest uses the title for, but let's give it to them
    let pageTitle = window.content.document.title;
    if (pageTitle) {
      createURI.addQueryParam("title", encodeURIComponent(pageTitle));
    }

    // TODO: We don't yet support video pins
    createURI.addQueryParam("is_video", "false");

    // Open the create pin dialog
    let createDialogAttributes =
      "status=no,resizable=no,scrollbars=yes,personalbar=no,directories=no," +
      "location=yes,toolbar=no,menubar=no,width=632,height=270,left=0,top=0";
    window.open(createURI.toString(), "", createDialogAttributes);
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
  // Only show the pinning options when it makes sense
  function enablePinBeforePopupShowing(aEvent) {
    let target = document.popupNode;

    let menuitem = document.getElementById("pinterest-context-pinit");
    let pinbgitem = document.getElementById("pinterest-context-pinbgimage");

    // Clear old event listeners
    if (PinterestAddon.menuItemListener) {
      menuitem.removeEventListener("command", PinterestAddon.menuItemListener);
    }
    if (PinterestAddon.pinBgItemListener) {
      pinbgitem.removeEventListener("command",
        PinterestAddon.pinBgItemListener);
    }

    // Don't let users pin something off pinterest, they should probably re-pin
    let currentURI = new Uri(window.content.location.toString());
    if (/(.+\.)?pinterest.com/.test(currentURI.host())) {
      pinbgitem.hidden = true;
      menuitem.hidden = true;
      return;
    }

    // Only images should be pinnable
    let isDirectlyPinnable = (target instanceof HTMLImageElement);
    menuitem.hidden = !isDirectlyPinnable;

    if (isDirectlyPinnable) {
      // This is bad, have URI parse and re-stringify to prevent code-injection
      PinterestAddon.menuItemListener = function() {
        PinterestAddon.pinTarget(target.src, target.alt);
      };
      menuitem.addEventListener("command", PinterestAddon.menuItemListener);
      pinbgitem.hidden = true;
    } else {
      let bgImageURL = PinterestAddon.findBackgroundImage(target);
      pinbgitem.hidden = !bgImageURL;
      if (bgImageURL) {
        PinterestAddon.pinBgItemListener = function() {
          PinterestAddon.pinTarget(bgImageURL);
        };
        pinbgitem.addEventListener("command", PinterestAddon.pinBgItemListener);
      }
    }

    // Break circular references
    pinbgitem = null;
    menuitem = null;
  }

  // Avoid circular-reference created by closure
  (function() {
    let menu = document.getElementById("contentAreaContextMenu");
    menu.addEventListener("popupshowing", enablePinBeforePopupShowing, false);
  })();
}, false);
