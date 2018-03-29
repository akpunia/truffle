var MemoryLogger = require("../memorylogger");
var CommandRunner = require("../commandrunner");
var fs = require("fs");
var path = require("path");
var assert = require("assert");
var Server = require("../server");
var Reporter = require("../reporter");
var sandbox = require("../sandbox");
var log = console.log;

describe.skip("Repeated compilation of contracts with inheritance", function() {
  var config;
  var contracts;
  var contractPaths;
  var artifactPaths;
  var output;
  var mapping = {};

  var project = path.join(__dirname, '../../sources/inheritance');
  var names = ["Root", "Branch", "LeafA", "LeafB", "LeafC", "Other", "LibraryA"];
  var logger = new MemoryLogger();

  before("set up the server", function(done) {
    Server.start(done);
  });

  after("stop server", function(done) {
    Server.stop(done);
  });

  beforeEach("set up sandbox", function() {
    return sandbox.create(project).then(conf => {
      config = conf;
      config.network = "development";
      config.logger = logger;
      config.mocha = {
        reporter: new Reporter(logger),
      }

      contracts = names.map(name => name + '.sol');
      artifactPaths = names.map(name => path.join(config.contracts_build_directory, name + '.json'));
      contractPaths = contracts.map(contract => path.join(config.contracts_directory, contract));

      names.forEach((name, i) => {
        mapping[name] = {};
        mapping[name].contract = contracts[i];
        mapping[name].artifactPath = artifactPaths[i];
        mapping[name].contractPath = contractPaths[i];
      })
    });
  });

  // ----------------------- Utils -----------------------------
  function processErr(err, output){
    if (err){
      log(output);
      throw new Error(err);
    }
  }

  function getContract(key) {
    return fs.readFileSync(mapping[key].contractPath);
  }

  function getArtifact(key) {
    return fs.readFileSync(mapping[key].artifactPath);
  }

  function getArtifactStats() {
    const stats = {};
    names.forEach(key => stats[key] = fs.statSync(mapping[key].artifactPath).mtimeMs);
    return stats;
  }

  function touchContract(key, file) {
    fs.writeFileSync(mapping[key].contractPath, file);
  }

  // -------------Inheritance Graph -----------------------------
  //                                      |
  //      LibA         LeafA              |
  //     /           /       \            |
  // Root* - Branch -           - LeafC   |    Other - LeafC
  //                 \       /            |
  //                   LeafB              |
  // ------------------------------------------------------------

  it("Updates only Root when Root is touched", function(done) {
    this.timeout(30000);

    CommandRunner.run("compile", config, function(err) {
      output = logger.contents();
      processErr(err, output);

      const initialTimes = getArtifactStats();

      const root = getContract('Root');
      touchContract('Root', root);

      CommandRunner.run("compile", config, function(err) {
        output = logger.contents();
        processErr(err, output);

        const finalTimes = getArtifactStats();

        try {
          assert(initialTimes['Root'] < finalTimes['Root'], 'Should update root');
          assert(initialTimes['Branch'] === finalTimes['Branch'], 'Should not update Branch');
          assert(initialTimes['LeafA'] === finalTimes['LeafA'], 'Should not update LeafA');
          assert(initialTimes['LeafB'] === finalTimes['LeafB'], 'Should not update LeafB');
          assert(initialTimes['LeafC'] === finalTimes['LeafC'], 'Should not update LeafC');
          assert(initialTimes['LibraryA'] === finalTimes['LibraryA'], 'Should not update LibraryA');
          assert(initialTimes['Other'] === finalTimes['Other'], 'Should not update Other');
          done();
        } catch(err) {
          err.message += '\n\n' + output;
          throw new Error(err);
        }
      });
    });
  });

  // -------------Inheritance Graph -----------------------------
  //                                      |
  //      LibA*        LeafA              |
  //     /           /       \            |
  // Root* - Branch -           - LeafC   |    Other - LeafC
  //                 \       /            |
  //                   LeafB              |
  // ------------------------------------------------------------

  it("Updates Root and Library when Library is touched", function(done) {
    this.timeout(30000);

    CommandRunner.run("compile", config, function(err) {
      output = logger.contents();
      processErr(err, output);

      const initialTimes = getArtifactStats();

      const library = getContract('LibraryA');
      touchContract('LibraryA', library);

      CommandRunner.run("compile", config, function(err) {
        output = logger.contents();
        processErr(err, output);

        const finalTimes = getArtifactStats();

        try {
          assert(initialTimes['Root'] < finalTimes['Root'], 'Should update root');
          assert(initialTimes['Branch'] === finalTimes['Branch'], 'Should not update Branch');
          assert(initialTimes['LeafA'] === finalTimes['LeafA'], 'Should not update LeafA');
          assert(initialTimes['LeafB'] === finalTimes['LeafB'], 'Should not update LeafB');
          assert(initialTimes['LeafC'] === finalTimes['LeafC'], 'Should not update LeafC');
          assert(initialTimes['LibraryA'] < finalTimes['LibraryA'], 'Should update LibraryA');
          assert(initialTimes['Other'] === finalTimes['Other'], 'Should not update Other');
          done();
        } catch(err) {
          err.message += '\n\n' + output;
          throw new Error(err);
        }
      });
    });
  });

  // -------------Inheritance Graph -----------------------------
  //                                      |
  //      LibA         LeafA              |
  //     /           /       \            |
  // Root* - Branch* -           - LeafC  |    Other - LeafC
  //                 \       /            |
  //                   LeafB              |
  // ------------------------------------------------------------

  it("Updates Branch and Root when Branch is touched", function(done) {
    this.timeout(30000);

    CommandRunner.run("compile", config, function(err) {
      output = logger.contents();
      processErr(err, output);

      const branch = getContract('Branch');
      touchContract('Branch', branch);

      CommandRunner.run("compile", config, function(err) {
        output = logger.contents();
        processErr(err, output);

        try {
          assert(initialTimes['Root'] < finalTimes['Root'], 'Should update root');
          assert(initialTimes['Branch'] < finalTimes['Branch'], 'Should update Branch');
          assert(initialTimes['LeafA'] === finalTimes['LeafA'], 'Should not update LeafA');
          assert(initialTimes['LeafB'] === finalTimes['LeafB'], 'Should not update LeafB');
          assert(initialTimes['LeafC'] === finalTimes['LeafC'], 'Should not update LeafC');
          assert(initialTimes['LibraryA'] === finalTimes['LibraryA'], 'Should not update LibraryA');
          assert(initialTimes['Other'] === finalTimes['Other'], 'Should not update Other');
          done();
        } catch(err) {
          err.message += '\n\n' + output;
          throw new Error(err);
        }
      });
    });
  });

  // -------------Inheritance Graph -----------------------------
  //                                       |
  //      LibA          LeafA*             |
  //     /            /       \            |
  // Root* - Branch* -           - LeafC   |    Other - LeafC
  //                  \       /            |
  //                    LeafB              |
  // ------------------------------------------------------------

  it("Updates LeafA, Branch and Root when LeafA is touched", function(done) {
    this.timeout(30000);

    CommandRunner.run("compile", config, function(err) {
      output = logger.contents();
      processErr(err, output);

      const leafA = getContract('LeafA');
      touchContract('LeafA', leafA);

      CommandRunner.run("compile", config, function(err) {
        output = logger.contents();
        processErr(err, output);

        try {
          assert(initialTimes['Root'] < finalTimes['Root'], 'Should update root');
          assert(initialTimes['Branch'] < finalTimes['Branch'], 'Should update Branch');
          assert(initialTimes['LeafA'] < finalTimes['LeafA'], 'Should update LeafA');
          assert(initialTimes['LeafB'] === finalTimes['LeafB'], 'Should not update LeafB');
          assert(initialTimes['LeafC'] === finalTimes['LeafC'], 'Should not update LeafC');
          assert(initialTimes['LibraryA'] === finalTimes['LibraryA'], 'Should not update LibraryA');
          assert(initialTimes['Other'] === finalTimes['Other'], 'Should not update Other');
          done();
        } catch(err) {
          err.message += '\n\n' + output;
          throw new Error(err);
        }
      });
    });
  });

  // -------------Inheritance Graph -----------------------------
  //                                       |
  //      LibA         LeafA*              |
  //     /           /        \            |
  // Root* - Branch* -           - LeafC*  |    Other* - LeafC*
  //                 \        /            |
  //                   LeafB*              |
  // ------------------------------------------------------------

  it("Updates everything except LibraryA when LeafC is touched", function(done) {
    this.timeout(30000);

    CommandRunner.run("compile", config, function(err) {
      output = logger.contents();
      processErr(err, output);

      const leafC = getContract('LeafC');
      touchContract('LeafC', leafC);

      CommandRunner.run("compile", config, function(err) {
        output = logger.contents();
        processErr(err, output);

        try {
          assert(initialTimes['Root'] < finalTimes['Root'], 'Should update root');
          assert(initialTimes['Branch'] < finalTimes['Branch'], 'Should update Branch');
          assert(initialTimes['LeafA'] < finalTimes['LeafA'], 'Should update LeafA');
          assert(initialTimes['LeafB'] < finalTimes['LeafB'], 'Should update LeafB');
          assert(initialTimes['LeafC'] < finalTimes['LeafC'], 'Should update LeafC');
          assert(initialTimes['LibraryA'] === finalTimes['LibraryA'], 'Should not update LibraryA');
          assert(initialTimes['Other'] < finalTimes['Other'], 'Should update Other');
          done();
        } catch(err) {
          err.message += '\n\n' + output;
          throw new Error(err);
        }
      });
    });
  });
});
