pinterestrc.ThumbnailRewrite = (function() {

  let FacebookRewrite = {
    // TODO: If this rewrite logic is wrong, it'll fail terribly.
    rewrite : function facebookRewrite(aURI) {
      // Facebook Photo Path
      // /<cdn_node>/<resize_params>/<fileid>_<filesize>.jpg
      //
      // We'll remove any resize_params if they exist and specify the filesize to
      // be the largest size 'n' guaranteed to be available in an upload.
      let pathPieces = aURI.path.split("/");
      let cdnNode = pathPieces[1];
      let fileName = pathPieces[pathPieces.length - 1];

      // Change file size
      fileName.replace(/_.\.jpg$/i, "_n.jpg");
      // Discard resize params
      aURI.path = "/" + cdnNode + "/" + fileName;

      return aURI;
    }
  };

  let YouTubeRewrite = {
    rewrite : function youtubeRewrite(aURI) {
      // YouTube Video Thumbnail Path:
      // /vi/<video_id>/<thumbnail_specifier>.jpg
      let pathPieces = aURI.path.split("/");
      let videoId = pathPieces[2];

      return makeURI("http://img.youtube.com/vi/" + videoId + "/0.jpg");
    }
  };

  let RewriteMap = [
    { k : /^https?:\/\/fbcdn-sphotos.a.akamaihd.net/, v : FacebookRewrite },
    { k : /^https?:\/\/[^\.]+\.ytimg.com\/vi\//, v : YouTubeRewrite },
    { k : /^https?:\/\/img.youtube.com\/vi\//, v : YouTubeRewrite },
  ];

  return {
    getCanonicalThumbnailURI : function getCanonicalThumbnailURI(aURI) {
      let uriString = aURI.resolve("");
      for (let i = 0, len = RewriteMap.length; i < len; i++) {
        if (RewriteMap[i].k.test(uriString)) {
          return RewriteMap[i].v.rewrite(aURI);
        }
      }

      return aURI;
    }
  };
})();
