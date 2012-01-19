Components.utils.import("chrome://pinterest-modules/content/Uri.jsm");

/**
 * Handles the pinning action, fetching parameters from target information
 */
function pinTarget(aEvent) {
  let target = document.popupNode;
  // TODO: Sometimes, we might want to look up the DOM tree for the target
  if (!(target instanceof HTMLImageElement)) {
    return;
  }

  let createURI = new Uri("http://pinterest.com/pin/create/bookmarklet/");
  let mediaURI = new Uri(target.src);

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
    if (pathPieces.length == 2) {
      let impliedMediaURI =
        mediaURI.clone().setPath("/" + pathPieces.join("/"));
    } else if (pathPieces.length == 3) {
      let impliedMediaURI = 
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
  if (target.alt) {
    createURI.addQueryParam("alt", encodeURIComponent(target.alt));
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
}

/**
 * Initializes required event handlers
 */
window.addEventListener("load", function() {
  // Only show the "Pin It" when it makes sense
  function enablePinBeforePopupShowing(aEvent) {
    let menuitem = document.getElementById("pinterest-context-pinit");

    // Don't let users pin something off pinterest
    let currentURI = new Uri(window.content.location.toString());
    if (/(.+\.)?pinterest.com/.test(currentURI.host())) {
      menuitem.hidden = true;
      return;
    }

    // Only images should be pinnable
    menuitem.hidden = !(document.popupNode instanceof HTMLImageElement);
  }

  let menu = document.getElementById("contentAreaContextMenu");
  menu.addEventListener("popupshowing", enablePinBeforePopupShowing, false);
}, false);
