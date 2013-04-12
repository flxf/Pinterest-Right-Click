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

function pinHandler(aDict) {
  let type = aDict['type'];
  delete aDict['type'];

  if (type == 'label') {
    this.label = _(aDict['label']);
  } else if (type == 'pin') {
    let createURI = 'http://pinterest.com/pin/create/bookmarklet/';

    let pinParams = {};
    ThumbnailRewrite.rewriteParams(aDict);
    let queryString = qs.stringify(aDict);

    // Open create pin dialog as a modal panel
    let createPinPanel = Panel({
      contentURL: createURI + '?' + queryString,
      width: 650,
      height: 270
    });

    var panelTab = tabs.activeTab;
    panelTab.attach({
      contentScriptFile: data.url('add_backdrop.js')
    });
    createPinPanel.on('hide', function() {
      panelTab.attach({
        contentScriptFile: data.url('remove_backdrop.js')
      });
    });

    createPinPanel.show();
  }
}

cm.Item({
  label: _('pin_image'),
  image: data.url('favicon.ico'),
  contentScriptFile: [ data.url('services_core.js'), data.url('context.js') ],
  onMessage: pinHandler
});
