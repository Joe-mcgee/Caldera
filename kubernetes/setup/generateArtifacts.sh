configtxgen --configPath /shared/setup -profile CalderaOrdererGenesis -outputBlock /shared/genesis.block
configtxgen --configPath /shared/setup -profile CalderaChannel -outputCreateChannelTx /shared/caldera.tx -channelID caldera
configtxgen --configPath /shared/setup -profile CalderaChannel -outputAnchorPeersUpdate /shared/artistAnchor.tx -channelID caldera -asOrg artist-org
configtxgen --configPath /shared/setup -profile CalderaChannel -outputAnchorPeersUpdate /shared/archiveAnchor.tx -channelID caldera -asOrg archive-org