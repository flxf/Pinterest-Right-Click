const _ = require('l10n').get;
const cm = require('context-menu');
const data = require('self').data;
const qs = require('querystring');
const tabs = require('tabs');
const { PageMod } = require('page-mod');
const { Panel } = require('panel');

const { ThumbnailRewrite } = require('./thumbnail_rules');

PageMod({
  include: '*',
  contentStyleFile: data.url('backdrop.css')
});

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
      let createURI = 'http://pinterest.com/pin/create/bookmarklet/';

      let pinParams = {};
      ThumbnailRewrite.rewriteParams(aDict);

      pinParams.media = aDict.media;
      if (aDict.alt !== undefined) {
        pinParams.alt = aDict.alt;
      }
      pinParams.is_video = (aDict.is_video !== undefined && aDict.is_video);
      let queryString = qs.stringify(pinParams);

      // Open create pin dialog as a modal panel
      let createPinPanel = Panel({
        contentURL: createURI + '?' + queryString,
        width: 650,
        height: 270
      });

      var panelTab = tabs.activeTab;
      createPinPanel.on('hide', function() {
        panelTab.attach({
          contentScriptFile: data.url('remove_backdrop.js')
        });
      });

      createPinPanel.show();
    }
  }
});
