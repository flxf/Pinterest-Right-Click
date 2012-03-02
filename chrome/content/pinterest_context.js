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
   *
   * TODO: This is gross unmaintainable Java-esque UI code. Although slower, we
   * should load the DOM structure stuff from an HTML fragment.
   */
  displayDialog : function displayDialog(createPath) {
    let doc = window.content.document;

    // Inject necessary CSS to show dialog. If the user has already pinned one
    // image from the page we can leave the injected CSS lying around since it
    // is unreferenced. If the user ends up pinning another image from the same
    // page, we then don't have to reload the CSS.
    let dialogStyle = doc.getElementById("pinterest-context-dialog-style");
    if (dialogStyle == null) {
      dialogStyle = doc.createElement("link");
      dialogStyle.setAttribute("rel", "stylesheet");
      dialogStyle.setAttribute("href", "resource://pinterest-context/dialog.css");
      doc.head.appendChild(dialogStyle);
    }

    // Create translucent overlay over page
    let dialogBackdrop = doc.createElement("div");
    dialogBackdrop.className = "pinterest-context-backdrop";
    doc.body.appendChild(dialogBackdrop);

    // Create dialog container
    let dialogBox = doc.createElement("div");
    dialogBox.className = "pinterest-context-dialog";

    let loadingImage = doc.createElement("img");
    loadingImage.src = "resource://pinterest-context/spinner.png";
    loadingImage.className = "pinterest-context-loading";
    dialogBox.appendChild(loadingImage);

    let loadingText = doc.createElement("div");
    // TODO: Localization Evil!
    loadingText.textContent = "loading";
    loadingText.className = "pinterest-context-loading-text";
    dialogBox.appendChild(loadingText);

    // Handle closing the dialog
    function escapeHandler(aEvent) {
      if (aEvent.keyCode == 27) { // escape key-code
        closeDialog();
        aEvent.stopPropagation();
      }
    };
    doc.addEventListener("keypress", escapeHandler, true);

    function closeDialog() {
      doc.body.removeChild(dialogBackdrop);
      doc.body.removeChild(dialogBox);
      doc.removeEventListener("keypress", escapeHandler, true);
      // We don't need to remove listeners attached to our newly created DOM
      // elements since we're destroying the elements.
    };

    // Clicking outside the dialog closes the dialog
    dialogBackdrop.addEventListener("click", closeDialog);

    // Create header {
    let dialogHeader = doc.createElement("div");
    dialogHeader.className = "pinterest-context-dialog-header";

      // Header text {
      let dialogHeaderText = doc.createElement("h2");
      // TODO: Localization Evil!
      dialogHeaderText.textContent = "Add a Pin";
      dialogHeaderText.className = "pinterest-context-dialog-header-text";
      //}

      // Close button {
      let dialogClose = doc.createElement("a");
      dialogClose.className = "pinterest-context-dialog-close";
      // CSS relies on having a nested span, see dialog.css
      dialogClose.appendChild(doc.createElement("span"));
      dialogClose.addEventListener("click", closeDialog);
      //}

    dialogHeader.appendChild(dialogHeaderText);
    dialogHeader.appendChild(dialogClose);
    //}

    // Use iframe to reach Pinterest
    let dialogFrame = doc.createElement("iframe");
    dialogFrame.setAttribute("class", "pinterest-context-dialog-frame");
    dialogFrame.setAttribute("src", createPath);

    // Our escape handler should capture when focussed inside the iframe as well
    dialogFrame.addEventListener("load", function(aEvent) {
      dialogFrame.contentWindow.addEventListener(
        "keypress", escapeHandler, true);
    });

    dialogBox.appendChild(dialogHeader);
    dialogBox.appendChild(dialogFrame);
    doc.body.appendChild(dialogBox);
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
