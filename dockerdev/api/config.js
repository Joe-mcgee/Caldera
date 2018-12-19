const readFileSync = require('fs').readFileSync;
const resolve = require('path').resolve;
const join = require('path').join;
module.exports = {
  collectionsConfigPath: resolve(__dirname, './caldera/src'),
  channelName: 'caldera',
  channelConfig: readFileSync(resolve(__dirname, './caldera.tx')),
  chaincodeId: 'caldera',
  chaincodeVersion: 'v1',
  chaincodePath: "caldera",
  orderer: {
    hostname: 'orderer1-orderer-org',
    url: 'grpcs://orderer1-orderer-org:7050',
    pem: readFileSync(resolve('./certs', 'orderer-org-ca-cert.pem')).toString()
  },
  artist: {
    peer: {
      hostname: 'peer1-artist-org',
      url: 'grpcs://peer1-artist-org:7051',
      pem: readFileSync(resolve('./certs', 'artist-org-ca-cert.pem')).toString()
    },
    ca: {
      hostname: 'rca-artist-org',
      url: 'https://rca-artist-org:7054',
      mspId: 'artist-orgMSP'
    },
    admin: {
      key: readFileSync(resolve('./certs', 'Admin@artist-org-key.pem')).toString(),
      cert: readFileSync(resolve('./certs', 'Admin@artist-org-cert.pem')).toString()
    },
    client: {
      key: readFileSync(resolve('./certs', 'peer1-artist-org-client.key')).toString(),
      cert: readFileSync(resolve('./certs', 'peer1-artist-org-client.crt')).toString()
    }
  },
  archive: {
    peer: {
      hostname: 'peer1-archive-org',
      url: 'grpcs://peer1-archive-org:7051',
      pem: readFileSync(resolve('./certs', 'archive-org-ca-cert.pem')).toString()
    },
    ca: {
      hostname: 'rca-archive-org',
      url: 'https://rca-archive-org:7054',
      mspId: 'archive-orgMSP'
    },
    admin: {
      key: readFileSync(resolve('./certs', 'Admin@archive-org-key.pem')).toString(),
      cert: readFileSync(resolve('./certs', 'Admin@archive-org-cert.pem')).toString()
    },
    client: {
      key: readFileSync(resolve('./certs', 'peer1-archive-org-client.key')).toString(),
      cert: readFileSync(resolve('./certs', 'peer1-archive-org-client.crt')).toString()
    }
  },
};