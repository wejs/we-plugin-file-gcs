/**
 * Script to import usert a sock price daily report
 */

const { Storage } = require('@google-cloud/storage');
const fs = require('fs');

module.exports = function URPCPCommand (program, helpers) {
  program
  .command('migrate-files-to-gcp')
  .option('-d, --date [date]', 'Date in format: DD/MM/YYYY')
  .description('Comando para migrar os arquivos para o GCP')
  .action( function run(opts) {
    const we = helpers.getWe();

    const ctx = {};

    const steps = [
      function setCTXStep(cb) { cb(null, ctx); },
      function initWeStep(ctx, cb) {
        // we.log.verbose()
        we.bootstrap( (err)=> {
          ctx.we = we;
          cb(err, ctx);
        });
      },
      function migrateFilesStep(ctx, cb) {
        migrateFiles(we, cb);
      },
      function migrateImagesStep(cb) {
        migrateImages(we, cb);
      },
    ];

    we.utils.async.waterfall(steps, (err)=> {
      if (err) {
        return doneAll(err);
      }

      doneAll();
    });

    function doneAll (err) {
      if (err) {
        if (err == 'List not avaible for selected date') {
          we.log.warn(err);
        } else {
          we.log.error('migrate-files-to-gcp:Done with error:', { error: err });

          return we.exit(()=> {
            process.exit(1);
          });
        }
      } else {
        we.log.verbose('migrate-files-to-gcp:Done all');
      }

      we.exit(()=> {
        setTimeout(()=> { process.exit(); }, 20);
      });
    }

  });
};

async function migrateFiles(we, cb) {
  await migrateAllFiles(we);

  cb();
}

async function migrateAllFiles(we, cb) {
  let lastId = 0;
  do {
    const fileRecord = await migrateOneFile(we, lastId)
    if(!fileRecord) return null;

    lastId = fileRecord.id;
  } while(lastId);

  return null;
}

async function migrateOneFile(we, lastId) {
  const file = await getFile(we, lastId);

  if (!file) return null;

  we.log.info('start file', file);

  const urls = file.urls;

  let fileChanged = false;

  for (let style in urls) {
    const url = urls[style];

    if (!url.startsWith('/api/v1')) {
      continue;
    }

    let oldPath = we.config.upload.file.uploadPath + '/' + file.name;
    const result = await uploadFile(we, file, oldPath);

    urls[style] = 'https://storage.googleapis.com/' +
      result.bucket + '/'+
      result.name;

    file.urls = urls;

    const extraData = file.extraData || {};

    if (!extraData.keys) {
      extraData.keys = {};
    }

    extraData.keys[style] = result.name;

    file.extraData = extraData;

    fs.unlinkSync(oldPath);

    fileChanged = true;
  }

  if (fileChanged) {
    file.storageName = 'gcs_file';
    file.isLocalStorage = false;
    await file.save();
  }

  we.log.info('end file', file);

  return file;
}

async function getFile(we, lastId = 0) {
  return we.db.models.file.findOne({
    where: {
      id: {
        [we.Op.gt]: lastId
      },
      isLocalStorage: true,
    },
    order: [['id', 'ASC']]
  })
}

// Images -
async function migrateImages(we, cb) {
  await migrateAllImages(we);
  cb();
}

async function migrateAllImages(we, cb) {
  let lastId = 0;
  do {
    const fileRecord = await migrateOneImage(we, lastId)
    if(!fileRecord) return null;

    lastId = fileRecord.id;
  } while(lastId);

  return null;
}

async function migrateOneImage(we, lastId) {
  const file = await getImage(we, lastId);

  if (!file) return null;

  we.log.info('start image', file);

  const urls = file.urls;

  let fileChanged = false;

  for (let style in urls) {
    const url = urls[style];

    if (!url.startsWith('/api/v1')) {
      continue;
    }

    let oldPath = we.config.upload.image.uploadPath + '/' + style + '/' + file.name;
    const result = await uploadFile(we, file, oldPath, style);

    urls[style] = 'https://storage.googleapis.com/' +
      result.bucket + '/'+
      result.name;

    file.urls = urls;

    const extraData = file.extraData || {};

    if (!extraData.keys) {
      extraData.keys = {};
    }

    extraData.keys[style] = result.name;

    file.extraData = extraData;

    fs.unlinkSync(oldPath);

    fileChanged = true;
  }

  if (fileChanged) {
    file.storageName = 'gcs_image';
    file.isLocalStorage = false;
    await file.save();
  }

  we.log.info('done image', file);

  return file;
}

async function getImage(we, lastId = 0) {
  return we.db.models.image.findOne({
    where: {
      id: {
        [we.Op.gt]: lastId
      },
      isLocalStorage: true,
    },
    order: [['id', 'ASC']]
  })
}

//

async function uploadFile(we, file, oldPath, style = 'original') {
  const gcs = new Storage({
    projectId: we.config.apiKeys.gcs.projectId,
    keyFilename: we.config.apiKeys.gcs.keyFilename
  });

  const $now = we.utils.moment();

  file.dateprefix = $now.format('YYYY/MM/DD');

  let destination = file.dateprefix + '/'+ style +'/' + file.name;

  const bucket = gcs.bucket(we.config.apiKeys.gcs.file_bucket_name);
  const result = await bucket.upload(oldPath, {
    destination,
  });

  return result[1];
}