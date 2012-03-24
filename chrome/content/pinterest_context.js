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
  let addMenuItem = function addMenuItem(aMenuItem, aDict) {
    let targetSrc = aDict.media;
    // TODO: Investigate whether we can get something for non-http
    if (!/^https?:\/\//.test(targetSrc)) {
      return false;
    }

    aMenuItem.hidden = false;
    let menuItemListener = function() {
      pinterestrc.PinterestContext.pinTarget(aDict);
    };
    aMenuItem.addEventListener("command", menuItemListener);

    // This is first menuitem inserted
    if (activeMenuHandlers.length == 0) {
      document.getElementById("pinterest-context-separator").hidden = false;
    }

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
    if (activeMenuHandlers.length > 0) {
      document.getElementById("pinterest-context-separator").hidden = true;

      for (let i = 0, len = activeMenuHandlers.length; i < len; i++) {
        let menuHandler = activeMenuHandlers[i];
        menuHandler.item.hidden = true;
        menuHandler.item.removeEventListener("command", menuHandler.listener);
      }
      activeMenuHandlers = [];
    }
  };

  return {
    addMenuItem : addMenuItem,
    unloadMenuItems : unloadMenuItems
  };
})();

pinterestrc.PinterestContext = {
  /**
   * Handles the pinning action, fetching parameters from target information
   */
  pinTarget : function pinTarget(aDict) {
    pinterestrc.ThumbnailRewrite.rewriteParams(aDict);

    let createURI = makeURI("http://pinterest.com/pin/create/bookmarklet/")
      .QueryInterface(Ci.nsIURL);

    let pinParams = {};

    pinParams.media = encodeURIComponent(aDict.media);

    if (aDict.url !== undefined && aDict.url) {
      pinParams.url = encodeURIComponent(aDict.url);
    } else {
      pinParams.url = encodeURIComponent(window.content.location.href);
    }

    // Set the alt test of the pin.
    if (aDict.alt !== undefined && aDict.alt) {
      pinParams.alt = encodeURIComponent(aDict.alt);
    }

    // Not sure what Pinterest uses the title for, but let's give it to them
    let pageTitle = window.content.document.title;
    if (pageTitle) {
      pinParams.title = encodeURIComponent(pageTitle);
    }

    pinParams.is_video = (aDict.is_video !== undefined && aDict.is_video);

    // Convert params to query string and append it to create uri
    let paramList = [];
    for (let key in pinParams) {
      paramList.push(key + "=" + pinParams[key]);
    }
    let queryString = "?" + paramList.join("&");
    createURI.query = queryString;

    this.displayDialog(createURI.resolve(""));
  },

  /**
   * Displays our custom-built 'add a pin' dialog
   */
  displayDialog : function displayDialog(createPath) {
    // TODO: THIS IS AN EMERGENCY FIX.
    //
    // BEGIN EMERGENCY FIX
    //
    //let doc = window.content.document;
    //doc.loadBindingDocument("resource://pinterest-context/dialogBinding.xml");

    //let dialog = doc.createElement("pinterest-dialog");
    //dialog.setAttribute("createpath", createPath);
    //doc.body.appendChild(dialog);

    // Open the create pin dialog
    let createDialogAttributes =
      "status=no,resizable=no,scrollbars=yes,personalbar=no,directories=no," +
      "location=yes,toolbar=no,menubar=no,width=632,height=270,left=0,top=0";
    window.open(createPath, "", createDialogAttributes);
    // END EMERGENCY FIX
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

    // Note: Targeting an element inside an iframe makes us behave as if we
    // we're visiting that iframe src. Currently, this fixes dialog behavior
    // because right-clicking the dialog should do nothing, as expected from a
    // Pinterest page. This isn't future-proof against new rules.
    let currentLocation = target.ownerDocument.location;

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
