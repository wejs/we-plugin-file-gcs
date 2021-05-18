# We.js Google Clowd file storage plugin

Add GCS storage option for we.js file plugin

## Requirements:

- GraficsMagic - http://www.graphicsmagick.org/ 
  For image resize

## Installation:

```sh
we i we-plugin-file-gcs
```

## Api

See **wejs/we-plugin-file**

## Configuration:

**config/local.js** file:

```js
  // ....
  apiKeys: {
    // configure AWS:
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
  // ....
```

## Roadmap 

- Add support for resize images in Google Clowd

## Links

> * We.js site: http://wejs.org

## Copyright and license

Copyright Alberto Souza <contato@albertosouza.net> and contributors , under [the MIT license](https://github.com/wejs/we-core/blob/master/LICENSE.md).