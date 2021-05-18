/**
 * Amazon AWS S3 storage plugin main file
 *
 * see http://wejs.org/docs/we/plugin
 */
const uuid = require('uuid'),
  request = require('request'),
  gm = require('gm'),
  path = require('path'),
  fs = require('fs'),
  os = require('os'),
  multerGoogleStorage = require('multer-cloud-storage'),
  { Storage } = require('@google-cloud/storage');

module.exports = function loadPlugin(projectPath, Plugin) {
  const plugin = new Plugin(__dirname);

  // set plugin configs
  plugin.setConfigs({
    apiKeys: {
      gcs: {
        image_bucket_name: '',
        file_bucket_name: '',
        autoRetry: true,
        maxRetries: 2,
        projectId: '',
        keyFilename: null,
        acl: 'private'
      }
    },

    upload: {
      storages: {
        gcs_file: {
          isLocalStorage: false,
          getStorage(we) {
            if (!we.config.apiKeys.gcs) {
              console.log('configure your Google Clowd api keys in: we.config.apiKeys.gcs');
              we.exit(process.exit);
            }

            plugin.storage = multerGoogleStorage.storageEngine({
              // s3: plugin.s3,
              bucket: we.config.apiKeys.gcs.file_bucket_name,
              keyFilename: we.config.apiKeys.gcs.keyFilename,

              // destination: 'images',

              autoRetry: we.config.apiKeys.gcs.autoRetry,
              maxRetries: we.config.apiKeys.gcs.maxRetries,
              acl: we.config.apiKeys.gcs.acl,
              projectId: we.config.apiKeys.gcs.projectId,

              uniformBucketLevelAccess: we.config.apiKeys.gcs.uniformBucketLevelAccess,


              filename: function (req, file, callback) {
                file.name = Date.now() + '_' + uuid.v1() + '.' + (file.originalname.split('.').pop().toLowerCase());
                callback(null, file.name);
              },

              // contentType: (we.config.apiKeys.s3.contentType || multerS3.AUTO_CONTENT_TYPE),

              metadata: this.fileToUploadMetadata,

              key(req, file, cb) {
                cb(null, Date.now() + '_' + uuid.v1()) ;
              }
            });

            return plugin.storage;
          },

          /**
           * Send one file to user
           *
           * TODO add support for image resize:
           *
           * @param  {Object} file
           * @param  {Object} req
           * @param  {Object} res
           * @param  {String} style
           */
          sendFile(file, req, res, style) {
            if (!style) style = 'original';
            // send to s3 file
            res.redirect( file.urls[ style ] );
          },

          /**
           * Default destroy file event:
           *
           * @param  {Object}   file file data
           * @param  {Function} done callback
           */
          destroyFile(file, done) {
            const we = plugin.we;

            plugin.deleteFile({
              bucket: we.config.apiKeys.gcs.file_bucket_name,
              projectId: we.config.apiKeys.gcs.projectId,
              keyFilename: we.config.apiKeys.gcs.keyFilename,
              fileName: file.name,
            }, (err, data)=> {
              if (err) {
                plugin.we.log.error('error on delete image from GCP:', data);
              }

              done(err, data);
            });
          },

          /**
           * Override this function to send custom file metadata on upload to GCS
           *
           * @param  {Object}   req  Current user request
           * @param  {Object}   file File metadata to be uploaded
           * @param  {Function} cb   callback
           */
          fileToUploadMetadata(req, file, cb) {
            cb(null);
          },

          /**
           * Method for get url from file
           *
           * @param  {String} format Ex: thumbnail
           * @param  {Object} file   Uploaded file data
           * @return {String}        url
           */
          getUrlFromFile(format, file) {
            if (!file.extraData) {
              file.extraData = {
                public_id: file.name,
                bucket: file.bucket,
                storageClass: 'gcp',
                keys: { original: file.name }
              };
            }

            // resolve other data:
            file.mime = file.mimetype;

            // get extension:
            const fParts = file.originalname.split('.');
            file.extension = '.'+fParts[fParts.length-1];

            return file.linkUrl;
          },

          /**
           * Make unique file name
           *
           * @param  {Object} req
           * @param  {Object} file
           * @return {String}      new file name
           */
          filename() {
            return Date.now() + '_' + uuid.v1();
          },
        },
        gcs_image: {
          isLocalStorage: false,
          getStorage(we) {
            if (!we.config.apiKeys.gcs) {
              console.log('configure your Google Clowd api keys in: we.config.apiKeys.gcs');
              we.exit(process.exit);
            }

            plugin.storage = multerGoogleStorage.storageEngine({
              // s3: plugin.s3,
              bucket: we.config.apiKeys.gcs.image_bucket_name,
              keyFilename: we.config.apiKeys.gcs.keyFilename,

              // destination: 'files',

              autoRetry: we.config.apiKeys.gcs.autoRetry,
              maxRetries: we.config.apiKeys.gcs.maxRetries,
              acl: we.config.apiKeys.gcs.acl,
              projectId: we.config.apiKeys.gcs.projectId,

              uniformBucketLevelAccess: we.config.apiKeys.gcs.uniformBucketLevelAccess,

              filename: function (req, file, callback) {
                file.name = Date.now() + '_' + uuid.v1() + '.' + (file.originalname.split('.').pop().toLowerCase());
                callback(null, file.name);
              },

              // contentType: (we.config.apiKeys.s3.contentType || multerS3.AUTO_CONTENT_TYPE),

              metadata: this.fileToUploadMetadata,

              key(req, file, cb) {
                cb(null, Date.now() + '_' + uuid.v1()) ;
              }
            });

            return plugin.storage;
          },

          /**
           * Send one file to user
           *
           * TODO add support for image resize:
           *
           * @param  {Object} file
           * @param  {Object} req
           * @param  {Object} res
           * @param  {String} style
           */
          sendFile(file, req, res, style) {
            if (!style) style = 'original';
            // send to s3 file
            res.redirect( file.urls[ style ] );
          },

          /**
           * Default destroy file event:
           *
           * @param  {Object}   file file data
           * @param  {Function} done callback
           */
          destroyFile(file, done) {
            const we = plugin.we;

            const keys = [];

            if (file.extraData && file.extraData.keys) {
              // get other formats:
              for(let format in file.extraData.keys) {
                keys.push(file.extraData.keys[format]);
              }
            }

            we.utils.async.eachSeries(keys, (key, next)=> {
              plugin.deleteFile({
                bucket: we.config.apiKeys.gcs.image_bucket_name,
                projectId: we.config.apiKeys.gcs.projectId,
                keyFilename: we.config.apiKeys.gcs.keyFilename,
                fileName: key,
              }, (err, data)=> {
                if (err) {
                  plugin.we.log.error('error on delete image from GCP:', data);
                }

                next();
              });
            }, (err)=> {
              done(err);
            });
          },

          /**
           * Override this function to send custom file metadata on upload to GCS
           *
           * @param  {Object}   req  Current user request
           * @param  {Object}   file File metadata to be uploaded
           * @param  {Function} cb   callback
           */
          fileToUploadMetadata(req, file, cb) {
            cb(null);
          },

          /**
           * Method for get url from file
           *
           * @param  {String} format Ex: thumbnail
           * @param  {Object} file   Uploaded file data
           * @return {String}        url
           */
          getUrlFromFile(format, file) {
            if (!file.extraData) {
              file.extraData = {
                public_id: file.name,
                bucket: file.bucket,
                storageClass: 'gcp',
                keys: { original: file.name }
              };
            }

            // resolve other data:
            file.mime = file.mimetype;

            // get extension:
            const fParts = file.originalname.split('.');
            file.extension = '.'+fParts[fParts.length-1];

            return file.linkUrl;
          },

          /**
           * Make unique file name
           *
           * @param  {Object} req
           * @param  {Object} file
           * @return {String}      new file name
           */
          filename() {
            return Date.now() + '_' + uuid.v1();
          },

          /**
           * Generate all image styles for one uploaded image
           *
           * TODO add support for amazon lambda
           *
           * @param  {Object}   file Image data
           * @param  {Function} done Callback
           */
          generateImageStyles(file, done) {
            const we = plugin.we,
              styles = we.config.upload.image.avaibleStyles,
              styleCfgs = plugin.we.config.upload.image.styles;

            // reload original file to stream to new file versions:
            const originalImageStream = request(file.urls.original);

            we.utils.async.each(styles, function resizeEach(style, next) {
              const width = styleCfgs[style].width,
                height = styleCfgs[style].heigth,
                tempFile = path.resolve(os.tmpdir(), 'gcs_'+file.name+'_'+style);

              // resize the image from stream:
              gm(originalImageStream)
              .resize(width, height, '^')
              .gravity('Center')
              .crop(width, height)
              .write(tempFile, (err)=> {
                if (err) {
                  we.log.error('Error on resize GCS image:', err);
                  return done(err);
                }

                plugin.uploadFile({
                  bucket: we.config.apiKeys.gcs.image_bucket_name,
                  projectId: we.config.apiKeys.gcs.projectId,
                  keyFilename: we.config.apiKeys.gcs.keyFilename,
                  filePath: tempFile,
                  destination: style + '/' + file.name,
                },(err, data)=> {
                  if (err) {
                    we.log.error('Error on save image resized version in GCS', err);
                  } else {
                    const extraData = file.extraData;
                    extraData.keys[style] = style + '/' + file.name;
                    file.extraData = extraData;

                    file.urls[style] = data.metadata.selfLink;
                  }

                  fs.unlinkSync(tempFile);

                  next(err);
                })
              });

            }, done);
          }
        }
      }
    }
  });

  /**
   * Plugin fast loader
   *
   * Defined for faster project bootstrap
   *
   * @param  {Object}   we
   * @param  {Function} done callback
   */
  plugin.fastLoader = function fastLoader(we, done) {
    done();
  };

  plugin.uploadFile = function (opts, cb) {
    const gcs = new Storage({
      projectId: opts.projectId,
      keyFilename: opts.keyFilename
    });

    const bucket = gcs.bucket(opts.bucket);
    bucket.upload(opts.filePath, {
      destination: opts.destination,
    }, cb);
  }

  plugin.deleteFile = function (opts, cb) {
    const gcs = new Storage({
      projectId: opts.projectId,
      keyFilename: opts.keyFilename
    });

    const bucket = gcs.bucket(opts.bucket)
      .file(opts.fileName)
      .delete({}, cb);
  }


  return plugin;
};
