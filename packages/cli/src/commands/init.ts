// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import fs from 'fs';
import path from 'path';
import {Command, flags} from '@oclif/command';
import cli from 'cli-ux';
import {createProject, installDependencies} from '../controller/init-controller';
import {getAlgorandGenesisHash, getGenesisHash} from '../jsonrpc';
import {BlockchainType, ProjectSpecBase, ProjectSpecV0_2_0, ProjectSpecV0_2_1} from '../types';

export default class Init extends Command {
  static description = 'Initialize a scaffold subquery project';

  static blockChainGenesisGetters(blockChain: BlockchainType): (endpoint: string) => Promise<string> {
    switch (blockChain) {
      case 'polkadot':
        return getGenesisHash;
      case 'algorand':
        return getAlgorandGenesisHash;
      default:
        return () => Promise.resolve('');
    }
  }

  static defaultEndpoints(blockChain: BlockchainType): string {
    switch (blockChain) {
      case 'polkadot':
        return 'wss://polkadot.api.onfinality.io/public-ws';
      case 'algorand':
        return 'https://algoexplorerapi.io';
      default:
        return '';
    }
  }

  static flags = {
    force: flags.boolean({char: 'f'}),
    starter: flags.boolean({
      default: true,
    }),
    location: flags.string({char: 'l', description: 'local folder to create the project in'}),
    'install-dependencies': flags.boolean({description: 'Install dependencies as well', default: false}),
    npm: flags.boolean({description: 'Force using NPM instead of yarn, only works with `install-dependencies` flag'}),
    specVersion: flags.string({
      required: false,
      options: ['0.0.1', '0.2.0', '0.2.1'],
      default: '0.2.1',
      description: 'The spec version to be used by the project',
    }),
    blockChain: flags.string({
      required: false,
      options: ['polkadot', 'algorand'],
      default: 'polkadot',
      description: 'The blockchain to be used by the project',
    }),
  };

  static args = [
    {
      name: 'projectName',
      description: 'Give the starter project name',
    },
  ];

  async run(): Promise<void> {
    const {args, flags} = this.parse(Init);
    const project = {} as ProjectSpecBase;

    const location = flags.location ? path.resolve(flags.location) : process.cwd();

    project.name = args.projectName
      ? args.projectName
      : await cli.prompt('Project name', {default: 'subql-starter', required: true});
    if (fs.existsSync(path.join(location, `${project.name}`))) {
      throw new Error(`Directory ${project.name} exists, try another project name`);
    }
    project.repository = await cli.prompt('Git repository', {required: false});

    project.endpoint = await cli.prompt('RPC endpoint', {
      default: Init.defaultEndpoints(flags.blockChain as BlockchainType),
      required: true,
    });

    if (flags.specVersion === '0.2.0') {
      cli.action.start('Getting network genesis hash');
      (project as ProjectSpecV0_2_0).genesisHash = await getGenesisHash(project.endpoint);
      cli.action.stop();
    }

    if (flags.specVersion === '0.2.1') {
      cli.action.start('Getting network genesis hash');

      const genesisHashGetter = Init.blockChainGenesisGetters(flags.blockChain as BlockchainType);

      (project as ProjectSpecV0_2_1).blockchainType = flags.blockChain as BlockchainType;

      (project as ProjectSpecV0_2_1).genesisHash = await genesisHashGetter(project.endpoint);

      cli.action.stop();
    }

    this.log('Prompting remaining details');
    project.author = await cli.prompt('Authors', {required: true});
    project.description = await cli.prompt('Description', {required: false});
    project.version = await cli.prompt('Version:', {default: '1.0.0', required: true});
    project.license = await cli.prompt('License:', {default: 'MIT', required: true});

    if (flags.starter && project.name) {
      try {
        cli.action.start('Init the starter package');
        const projectPath = await createProject(location, project);
        cli.action.stop();

        if (flags['install-dependencies']) {
          cli.action.start('Installing dependencies');
          installDependencies(projectPath, flags.npm);
          cli.action.stop();
        }

        this.log(`${project.name} is ready`);

        /*
         * Explicitly exit because getGenesisHash creates a polkadot api instance that keeps running
         * Disconnecting the api causes undesired logging that cannot be disabled
         */
        process.exit(0);
      } catch (e) {
        /* handle all errors here */
        this.error(e.message);
      }
    }
  }
}
