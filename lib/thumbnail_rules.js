const { URL } = require('url');

var ThumbnailRewrite = (function() {

  let FacebookRewrite = {
    // TODO: If this rewrite logic is wrong, it'll fail terribly.
    rewrite : function facebookRewrite(aDict) {
      let uri = URL(aDict.media);

      // Facebook Photo Path
      // (1) /<cdn_node>/<resize_params>/<fileid>_<filesize>.jpg
      // (2) /<cdn_node>/v/<fileid>_<filesize>.jpg
      //
      // We'll remove any resize_params if they exist and specify the filesize to
      // be the largest size 'n' guaranteed to be available in an upload.
      let pathPieces = uri.path.split("/");
      let cdnNode = pathPieces[1];
      let fileName = pathPieces[pathPieces.length - 1];

      // Making a best-effort to not modify anything that doesn't match format
      // (1) from the above notes on facebook photo paths.
      if (pathPieces.length != 4 || !/\w\d+x\d+/.test(pathPieces[2])) {
        return;
      }

      // Change file size if smaller than desired
      if (/_[ast]\.jpg$/i.test(fileName)) {
        let sizeCharPos = fileName.length - 5;
        fileName[sizeCharPos] = 'n';
      }

      // Discard resize params
      // URL stopped being a write API at some point (2013.06.10)
      //uri.path = "/" + cdnNode + "/" + fileName;

      aDict.media = "https://" + uri.host + "/" + cdnNode + "/" + fileName;
      aDict.url = aDict.media;
    }
  };

  let YouTubeRewrite = {
    rewrite : function youtubeRewrite(aDict) {
      let uri = URL(aDict.media);

      // YouTube Video Thumbnail Path:
      // /vi/<video_id>/<thumbnail_specifier>.jpg
      let pathPieces = uri.path.split("/");
      let videoId = pathPieces[2];

      aDict.media = "http://img.youtube.com/vi/" + videoId + "/0.jpg";
      aDict.url = "http://www.youtube.com/watch?v=" + videoId;
      aDict.is_video = "true";
    }
  };

  let VimeoRewrite = {
    rewrite : function vimeoRewrite(aDict) {
      aDict.is_video = 'true';
    }
  };

  let RewriteMap = [
    { k : /^https?:\/\/fbcdn-sphotos\.a\.akamaihd.net/, v : FacebookRewrite },
    { k : /^https?:\/\/fbcdn-sphotos-.-a\.akamaihd.net/, v : FacebookRewrite },
    { k : /^https?:\/\/[^\.]+\.ytimg.com\/vi\//, v : YouTubeRewrite },
    { k : /^https?:\/\/img.youtube.com\/vi\//, v : YouTubeRewrite },
    { k : /^https?:\/\/b.vimeocdn.com/, v : VimeoRewrite },
    { k : /^https?:\/\/secure-b.vimeocdn.com/, v : VimeoRewrite }
  ];

  return {
    rewriteParams : function rewriteParams(aDict) {
      let mediaSrc = aDict.media;

      for (let i = 0, len = RewriteMap.length; i < len; i++) {
        if (RewriteMap[i].k.test(mediaSrc)) {
          RewriteMap[i].v.rewrite(aDict);
          return;
        }
      }
    }
  };
})();

exports.ThumbnailRewrite = ThumbnailRewrite;
