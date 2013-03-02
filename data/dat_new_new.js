self.port.on("makeContextMenu", function(aLabel, aFavicon) {
  let target = document.getElementsByTagName("img")[0];
  let currentLocation = document.location;
  let ssc = pinterestrc.SiteServicesController;
  let pinnable = ssc.handleLocation(currentLocation, target);

  if (!document.getElementById("FIXITFELIX")) {
    var img = document.getElementsByTagName("img")[0];
    img.setAttribute("contextmenu", "FIXITFELIX");

    // http://stackoverflow.com/questions/1891947/are-dynamically-inserted-script-tags-meant-to-work?rq=1
    var head = document.getElementsByTagName("head")[0];
    var stag = document.createElement("script");
    stag.type = "text/javascript";
    stag.text = "function sendMessage() { \
      window.postMessage('PinterestRightClickMessage', '*'); \
    }";
    head.appendChild(stag);

    // Be very relieved that these are safe strings
    img.insertAdjacentHTML("afterend",
      "<menu type='context' id='FIXITFELIX'> \
        <menuitem label=\"" + aLabel + "\" icon=\"" + aFavicon + "\" onclick='sendMessage()'></menuitem> \
      </menu>");
  }
});

document.defaultView.addEventListener('message', function(evt) {
  pinterestrc.SiteServicesController.lastData.type = 'pin';
  self.postMessage(pinterestrc.SiteServicesController.lastData);
}, false);
