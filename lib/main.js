var cm = require('context-menu');
const { Panel } = require('sdk/panel');
var querystring = require('querystring');
var data = require('self').data;
var _ = require('l10n').get;

cm.Item({
  label: _('pin_image'),
  image: data.url('favicon.ico'),
  contentScriptFile: data.url('services.js'),
  onMessage: function(aDict) {
    let type = aDict['type'];
    delete aDict['type'];

    if (type == 'label') {
      this.label = _('pin_youtube'),
      delete aDict['label'];
    } else {
      let createURI = "http://pinterest.com/pin/create/bookmarklet/";

      let pinParams = {};

      pinParams.media = aDict.media;
      //pinParams.url = (aDict.url !== undefined) ? aDict.url : window.content.location.href;
      pinParams.url = (aDict.url !== undefined) ? aDict.url : 'http://www.google.com';
      if (aDict.alt !== undefined) {
        pinParams.alt = aDict.alt;
      }
      // Not sure what Pinterest uses the title for, but let's give it to them
      //let pageTitle = window.content.document.title;
      //if (pageTitle) {
        //pinParams.title = pageTitle;
      //}
      pinParams.is_video = (aDict.is_video !== undefined && aDict.is_video);
      let queryString = querystring.stringify(pinParams);

      // The displaying
      let p = Panel({
        contentURL: createURI + '?' + queryString,
        width: 800,
        height: 600,
      });
      p.show();
    }
  }
});
