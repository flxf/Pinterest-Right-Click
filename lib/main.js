var cm = require('context-menu');
const { Panel } = require('sdk/panel');
var querystring = require('querystring');
var data = require('self').data;
var _ = require('l10n').get;
var rewrite = require('./thumbnail_rules');

cm.Item({
  label: _('pin_image'),
  image: data.url('favicon.ico'),
  contentScriptFile: data.url('services.js'),
  onMessage: function(aDict) {
    let type = aDict['type'];
    delete aDict['type'];

    if (type == 'label') {
      this.label = _(aDict['label']);
    } else {
      let createURI = "http://pinterest.com/pin/create/bookmarklet/";

      let pinParams = {};
      rewrite.ThumbnailRewrite.rewriteParams(aDict);

      pinParams.media = aDict.media;
      if (aDict.alt !== undefined) {
        pinParams.alt = aDict.alt;
      }
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
