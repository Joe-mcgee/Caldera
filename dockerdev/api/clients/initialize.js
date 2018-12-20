const hfc = require('fabric-client');
const utils = require('fabric-client/lib/utils');
const CAClient = require('fabric-ca-client');
const User = require('fabric-client/lib/User');
const http = require('http');
const resolve = require('path').resolve

const url = require('url')
const snakeToCamelCase = require('json-style-converter').snakeToCamelCase;
const camelToSnakeCase = require('json-style-converter').camelToSnakeCase;
const Long = require('long')

const config = require('../config');
process.env.GOPATH = resolve(__dirname, '../chaincode');

class CalderaClient {
  constructor(channelName, ordererConfig, peerConfig, caConfig, admin, clientTLS) {
    this._channelName = channelName;
    this._ordererConfig = ordererConfig;
    this._peerConfig = peerConfig;
    this._caConfig = caConfig;
    this._admin = admin;
    this._peers = [];
    this._client = new hfc();
    this._client.setTlsClientCertAndKey(clientTLS.cert, clientTLS.key)
    this._channel = this._client.newChannel(channelName);

    const orderer = this._client.newOrderer(ordererConfig.url, {
      pem: ordererConfig.pem,
      'ssl-target-name-override': ordererConfig.hostname
    });
    this._channel.addOrderer(orderer);
    const defaultPeer = this._client.newPeer(peerConfig.url, {
      pem: peerConfig.pem,
      /*'ssl-target-name-override': peerConfig.hostname*/
    });
    this._peers.push(defaultPeer);
    this._channel.addPeer(defaultPeer);
    this._adminUser = null;
  }

  async login() {
    try {
      console.log('inside login')
      this._client.setStateStore(
        await hfc.newDefaultKeyValueStore({
          path: `./${this._peerConfig.hostname}`
        }));
      this._adminUser = await getSubmitter(
        this._client, `${this._caConfig.hostname}-admin`, `${this._caConfig.hostname}-adminpw`, this._caConfig);
      console.log('outside getSubmitter')
    } catch (e) {
      console.log('failed to enroll user', e.message)
      throw e
    }
  }

  async getOrgAdmin() {
    return this._client.createUser({
      username: `Admin@${this._peerConfig.hostname}`,
      mspid: this._caConfig.mspId,
      cryptoContent: {
        privateKeyPEM: this._admin.key,
        signedCertPEM: this._admin.cert
      }
    })
  }

  async initialize() {
    try {
      await this._channel.initialize();
    } catch (e) {
      console.log('fail to initialize chain')
      throw e
    }
  }

  async checkChannelMembership() {
    try {
      console.log('inside channel member')
      console.log(this._peers[0])
      const { channels } = await this._client.queryChannels(this._peers[0]);
      console.log('quired channels')
      console.log('channels', channels)
      if (!Array.isArray(channels)) {
        return false;
      }
      return channels.some(({ channel_id }) => channel_id === this._channelName);
    } catch (e) {
      return false;
    }
  }

  async createChannel(envelope) {
    const txId = this._client.newTransactionID();
    const channelConfig = this._client.extractChannelConfig(envelope);
    const signature = this._client.signChannelConfig(channelConfig);
    const request = {
      name: this._channelName,
      orderer: this._channel.getOrderers()[0],
      config: channelConfig,
      signatures: [signature],
      txId
    };
    const response = await this._client.createChannel(request);
    console.log('createchannelres', response)
    await new Promise(resolve => {
      setTimeout(resolve, 5000);
    });
    return response;
  }

  async joinChannel() {
    try {
      console.log('in join channel')
      const genesisBlock = await this._channel.getGenesisBlock({
        txId: this._client.newTransactionID()
      });
      console.log('got genesisblock')
      const request = {
        targets: this._peers,
        txId: this._client.newTransactionID(),
        block: genesisBlock
      }
      await this._channel.joinChannel(request)
      console.log('joined channel')

    } catch (e) {
      console.log("failed join join peer to channel")
      throw e
    }
  }

  async checkInstalled(chaincodeId, chaincodeVersion, chaincodePath) {
    let { chaincodes } = await this._channel.queryInstantiatedChaincodes();
    if (!Array.isArray(chaincodes)) {
      return false
    }

    return chaincodes.some(cc =>
      cc.name === chaincodeId &&
      cc.path === chaincodePath &&
      cc.version === chaincodeVersion);
  }

  async install(chaincodeId, chaincodeVersion, chaincodePath) {
    const request = {
      targets: this._peers,
      chaincodePath,
      chaincodeId,
      chaincodeVersion
    };
    let results;
    try {
      results = await this._client.installChaincode(request);
    } catch (e) {
      console.log(request.chaincodePath)
      console.log('err sending install proposal to peer')
      throw e;
    }
    const proposalResponses = results[0];
    const good = proposalResponses.every(pr => pr.response && pr.response.status == 200);
    return good;
  }

  async instantiate(chaincodeId, chaincodeVersion, ...args) {
    let proposalResponses, proposal;
    const txId = this._client.newTransactionID();
    try {
      const request = {
        chaincodeType: 'golang',
        chaincodeId,
        chaincodeVersion,
        fcn: 'init',
        // for future contract seeds
        // args: marshalArgs(args),
        txId
        // 'collections_config': config.collectionsConfigPath
      };
      const results = await this._channel.sendInstantiateProposal(request);
      console.log(results[0].response)
      console.log(results[1].response)
      proposalResponses = results[0];
      proposal = results[1];

      let good = proposalResponses.every(pr => pr.response && pr.response.status == 200);

      if (!good) {
        throw new Error('proposal to instantiate rejected');
      }
    } catch (e) {
      throw e;
    }

    try {
      const request = {
        proposalResponses,
        proposal
      };
      const deployId = txId.getTransactionID();
      await this._channel.sendTransaction(request);
      console.log('past sendTransaction')
    } catch (e) {
      throw e
    }
  }

  async invoke(chaincodeId, chaincodeVersion, fcn, ...args) {
    let proposalResponses, proposal;
    console.log(args)
    console.log(...args)
    const txId = this._client.newTransactionID();
    try {
      const request = {
        chaincodeId,
        chaincodeVersion,
        fcn,
        args: marshalArgs(args),
        txId
      };
      const results = await this._channel.sendTransactionProposal(request);
      proposalResponses = results[0];
      proposal = results[1];

      const good = proposalResponses.every(pr => pr.response && pr.response.status == 200);

      if (!good) {
        throw new Error('proposal rejected by peer')
      }
    } catch (e) {
      throw e;
    }

    try {
      const request = {
        proposalResponses,
        proposal
      }


      try {

        await this._channel.sendTransaction(request);
        const payload = proposalResponses[0].response.payload;
        return unmarshalResult([payload]);

      } catch (e) {
        throw e;
      }
    } catch (e) {
      throw e
    }
  }

  async query(chaincodeId, chaincodeVersion, fcn, ...args) {
    const request = {
      chaincodeId,
      chaincodeVersion,
      fcn,
      args: marshalArgs(args),
      txId: this._client.newTransactionID()
    };
    return unmarshalResult(await this._channel.queryByChaincode(request))
  }

  async getBlocks(input) {
    const {
      height
    } = await this._channel.queryInfo();
    let blockCount;
    if (height.comp(input) > 0) {
      blockCount = input;
    } else {
      blockCount = height;
    }
    if (typeof blockCount === 'number') {
      blockCount = Long.fromNumber(blockCount, height.unsigned);
    } else if (typeof blockCount === 'string') {
      blockCount = Long.fromString(blockCount, height.unsigned);
    }
    blockCount = blockCount.toNumber();
    const queryBlock = this._channel.queryBlock.bind(this._channel);
    const blockPromises = {};
    blockPromises[Symbol.iterator] = function*() {
      for (let i = 1; i <= blockCount; i++) {
        yield queryBlock(height.sub(i).toNumber());
      }
    };
    const blocks = await Promise.all([...blockPromises]);
    return blocks.map(unmarshalBlock)
  }
}

function unmarshalBlock(block) {
  const transactions = Array.isArray(block.data.data) ?
    block.data.data.map(({
      payload: {
        header,
        data
      }
    }) => {
      const {
        channel_header
      } = header;
      const {
        type,
        timestamp,
        epoch
      } = channel_header;
      return {
        type,
        timestamp
      };
    }) : [];
  return {
    id: block.header.number.toString(),
    fingerprint: block.header.data_hash.slice(0, 20),
    transactions
  };
}

function getAdminOrgs() {
  return Promise.all([
    artistClient.getOrgAdmin(),
    archiveClient.getOrgAdmin(),
  ]);
}

/**
 * Enrolls a user with the respective CA.
 *
 * @export
 * @param {string} client
 * @param {string} enrollmentID
 * @param {string} enrollmentSecret
 * @param {object} { url, mspId }
 * @returns the User object
 */
async function getSubmitter(
  client, enrollmentID, enrollmentSecret, {
    url,
    mspId
  }) {

  try {
    let user = await client.getUserContext(enrollmentID, true);
    if (user && user.isEnrolled()) {
      return user;
    }

    // Need to enroll with CA server
    const ca = new CAClient(url, {
      verify: false
    });
    try {
      const enrollment = await ca.enroll({
        enrollmentID,
        enrollmentSecret
      });
      user = new User(enrollmentID, client);
      await user.setEnrollment(enrollment.key, enrollment.certificate, mspId);
      await client.setUserContext(user);
      return user;
    } catch (e) {
      throw new Error(
        `Failed to enroll and persist User. Error: ${e.message}`);
    }
  } catch (e) {
    throw new Error(`Could not get UserContext! Error: ${e.message}`);
  }
}

// Problematic function for variables with cases in centre
function marshalArgs(args) {
  if (!args) {
    return args
  }

  if (typeof args === 'string') {
    return [args];
  }

  let snakeArgs = camelToSnakeCase(args);

  if (Array.isArray(args)) {
    return args.map(
      arg => typeof arg === 'object' ? JSON.stringify(arg) : arg.toString());
  }

  if (typeof args === 'object') {
    return [JSON.stringify(args)];
  }
}

function unmarshalResult(result) {
  console.log("result", result)
  if (!Array.isArray(result)) {
    return result;
  }
  let buff = Buffer.concat(result);
  if (!Buffer.isBuffer(buff)) {
    return result;
  }
  let json = buff.toString('utf8');
  if (!json) {
    return null;
  }
  console.log(json)
  let obj = JSON.parse(json);
  return snakeToCamelCase(obj);
}


const artistClient = new CalderaClient(
  config.channelName,
  config.orderer,
  config.artist.peer,
  config.artist.ca,
  config.artist.admin,
  config.artist.client
);

const archiveClient = new CalderaClient(
  config.channelName,
  config.orderer,
  config.archive.peer,
  config.archive.ca,
  config.archive.admin,
  config.archive.client
);



async function createNetwork() {
  try {
    await Promise.all([
      artistClient.login(),
      archiveClient.login(),
    ]);
  } catch (e) {
    console.log(e);
    process.exit(-1);
  }

  try {
    await getAdminOrgs();
    if (!(await artistClient.checkChannelMembership())) {
      const createChannelResponse = await artistClient.createChannel(config.channelConfig);
      if (createChannelResponse.status === 'SUCCESS') {
        console.log('caldera channel created!');
        console.log('attempting to join peers');
        await Promise.all([
          artistClient.joinChannel(),
          archiveClient.joinChannel(),
        ]);

        await new Promise(resolve => {
          setTimeout(resolve, 10000);
        });
      }
    }
  } catch (e) {
    console.log('failed to create blockchain client');
    console.log(e)
    process.exit(-1)
  }

  try {
    await Promise.all([
      artistClient.initialize(),
      archiveClient.initialize(),
    ])
  } catch (e) {
    console.log('error initializing client')
    console.log(e)
    process.exit(-1)
  }

  //chaincode install

  let installedOnArtistOrg, installedOnArchiveOrg

  try {
    await getAdminOrgs();
    installedOnArtistOrg = await artistClient.checkInstalled(
      config.chaincodeId, config.chaincodeVersion, config.chaincodePath);
    installedOnArchiveOrg = await archiveClient.checkInstalled(
      config.chaincodeId, config.chaincodeVersion, config.chaincodePath);
  } catch (e) {
    console.log('failed getting installation status')
    console.log(e);
    process.exit(-1);
  }

  if (!installedOnArtistOrg && !installedOnArchiveOrg) {
    console.log('no cc installed, creating...')

    try {
      await getAdminOrgs();
      const socketPath = process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock';
      const ccenvImage = 'hyperledger/fabric-ccenv:x86_64-1.1.0';
      const listOpts = { socketPath, method: 'GET', path: '/images/json' };
      const pullOpts = {
        socketPath,
        method: 'POST',
        path: url.format({ pathname: '/images/create', query: { fromImage: ccenvImage } })
      };

      const images = await new Promise((resolve, reject) => {
        const req = http.request(listOpts, (response) => {
          let data = '';
          response.setEncoding('utf-8');
          response.on('data', chunk => { data += chunk; });
          response.on('end', () => { resolve(JSON.parse(data)); })
        });
        req.on('error', reject);
        req.end();
      });

      const imageExists = images.some(i => i.RepoTags && i.RepoTags.some(tag =>
        tag === ccenvImage));

      if (!imageExists) {
        console.log('base container not present, pulling from docker hub');
        await new Promise((resolve, reject) => {
          const req = http.request(pullOpts, (response) => {
            response.on('data', () => {});
            response.on('end', () => { resolve(); });
          });
          req.on('error', reject);
          req.end()
        });
        console.log('base container downloaded');
      } else {
        console.log('base container present')
      }
    } catch (e) {
      console.log('fatal error pulling docker')
      console.log(e)

      process.exit(-1)
    }

    // install cc

    const installationPromises = [
      artistClient.install(config.chaincodeId, config.chaincodeVersion, config.chaincodePath),
      archiveClient.install(config.chaincodeId, config.chaincodeVersion, config.chaincodePath)
    ];
    try {
      await Promise.all(installationPromises);
      await new Promise(resolve => { setTimeout(resolve, 10000); });
      console.log('successfully installed chaincode on caldera')
    } catch (e) {
      console.log('fatal error install cc on caldera');
      console.log(e);
      process.exit(-1);
    }

    //instantiate cc

    try {
      await artistClient.instantiate(config.chaincodeId, config.chaincodeVersion, {})

    } catch (e) {
      console.log('fatal err instantiating')
      console.log(e);
      process.exit(-1);
    }
  } else {
    console.log('cc already installed')
  }
}

/*const createPromise = new Promise((resolve, reject) => {
  (async () => {
  await createNetwork()
})();
  resolve("success")
})*/

(async () => {
  await createNetwork()
})();


module.exports.artistClient = artistClient
module.exports.archiveClient = archiveClient

module.exports.CalderaClient = CalderaClient