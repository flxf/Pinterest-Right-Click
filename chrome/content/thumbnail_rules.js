pinterestrc.ThumbnailRewrite = (function() {

  let FacebookRewrite = {
    // TODO: If this rewrite logic is wrong, it'll fail terribly.
    rewrite : function facebookRewrite(aSrc) {
      let uri = makeURI(aSrc);

      // Facebook Photo Path
      // /<cdn_node>/<resize_params>/<fileid>_<filesize>.jpg
      //
      // We'll remove any resize_params if they exist and specify the filesize to
      // be the largest size 'n' guaranteed to be available in an upload.
      let pathPieces = uri.path.split("/");
      let cdnNode = pathPieces[1];
      let fileName = pathPieces[pathPieces.length - 1];

      // Change file size
      fileName.replace(/_.\.jpg$/i, "_n.jpg");
      // Discard resize params
      uri.path = "/" + cdnNode + "/" + fileName;

      return uri.resolve("");
    }
  };

  let YouTubeRewrite = {
    rewrite : function youtubeRewrite(aSrc) {
      let uri = makeURI(aSrc);

      // YouTube Video Thumbnail Path:
      // /vi/<video_id>/<thumbnail_specifier>.jpg
      let pathPieces = uri.path.split("/");
      let videoId = pathPieces[2];

      return "http://img.youtube.com/vi/" + videoId + "/0.jpg";
    }
  };

  let RewriteMap = [
    { k : /^https?:\/\/fbcdn-sphotos.a.akamaihd.net/, v : FacebookRewrite },
    { k : /^https?:\/\/[^\.]+\.ytimg.com\/vi\//, v : YouTubeRewrite },
    { k : /^https?:\/\/img.youtube.com\/vi\//, v : YouTubeRewrite },
  ];

  return {
    getCanonicalThumbnailURI : function getCanonicalThumbnailURI(aSrc) {
      for (let i = 0, len = RewriteMap.length; i < len; i++) {
        if (RewriteMap[i].k.test(aSrc)) {
          return RewriteMap[i].v.rewrite(aSrc);
        }
      }

      return aSrc;
    }
  };
})();
