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
      if (!ssc.lastData.description) {
        ssc.lastData.description = pageTitle;
      }
    }

    self.postMessage({ type : 'label', label : ssc.lastData.label });
  }
  return pinnable;
});

self.on("click", function(aTarget) {
  pinterestrc.SiteServicesController.lastData.type = 'pin';
  self.postMessage(pinterestrc.SiteServicesController.lastData);
});
