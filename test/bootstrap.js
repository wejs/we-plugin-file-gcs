const projectPath = process.cwd(),
  deleteDir = require('rimraf'),
  testTools = require('we-test-tools'),
  path = require('path'),
  We = require('we-core');

let we;

before(function (callback) {
  testTools.copyLocalSQLiteConfigIfNotExists(projectPath, callback);
});

before(function(callback) {
  this.slow(100);

  const We = require('we-core');
  we = new We({ bootstrapMode: 'test' });
  testTools.init({}, we);

  we.bootstrap({
    i18n: {
      directory: path.join(__dirname, 'locales'),
      updateFiles: true
    },
    upload: {
      defaultImageStorage: 'gcs_image',
      defaultFileStorage: 'gcs_file'
    }
  } , function(err, we) {
    if (err) throw err;

    we.startServer(function(err) {
      if (err) throw err;
      callback();
    });
  });

});

// after all tests remove test folders and delete the database:
after(function (callback) {
  we.exit(()=> {
    const tempFolders = [
      projectPath + '/*.sqlite',
      projectPath + '/files/uploads',
      projectPath + '/files/gcs_*'
    ];

    we.utils.async.each(tempFolders, (folder, next)=> {
      deleteDir( folder, next);
    }, callback);
  });
});
