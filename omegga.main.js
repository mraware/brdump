const fs = require('fs');
const path = require('path');


class Dump {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;

    this.bricks = {};
  }

  async init() {
    this.omegga
      .on('cmd:dumpall', this.dumpAll)


    return {
      registeredCommands: ['dumpall']
    };
  }


  dumpAll = async () => {
    try {
      const classRegExp = /^(?<index>\d+)\) (?<type>.*) (?<className>.*)$/;
      const propsRegExp = /^(.*Prop (?<prop>.+) at offset .*type (?<type>.+))|(.*Flag (?<flag>CPF_.+))$/;

      const dumpPath = path.join(__dirname, 'dump');
      if (fs.existsSync(dumpPath)) {
        fs.rmdirSync(dumpPath, { recursive: true });
      }
      fs.mkdirSync(dumpPath);


      const classesMatch = await this.omegga.watchLogChunk('GetAll Class', classRegExp, { first: 'index' });

      const files = [];
      const weapons = [];

      if (classesMatch.length) {
        for (let i = 0; i < classesMatch.length; i++) {
          const { className, type } = classesMatch[i].groups;
          if (className.startsWith("/Game/Weapons/")) {
            const splitName = className.split('/');
            const weaponName = splitName[splitName.length - 1].split('.')[0]
            if (weaponName.startsWith('Weapon_')) weapons.push(weaponName);
          }
          console.log(`Read: ${i + 1}/${classesMatch.length}: ${className}`);
          const propsMatch = await this.omegga.watchLogChunk(`ListProps ${className} *`, propsRegExp, {});
          if (propsMatch) {
            const allProps = []
            let currProp = {}
            for (let { groups: props } of propsMatch) {
              if (props) {
                const { prop, type, flag } = props;
                if (prop) {
                  currProp = { prop, type };
                } else if (flag && currProp) {
                  if (flag === 'CPF_Net') {
                    allProps.push(currProp)
                    currProp = null;
                  }
                }
              }
            }
            if (allProps.length > 0) {
              const data = allProps.reduce((prev, curr) => prev + `${curr.prop} (${curr.type})` + '\n', `${className}\n\n`);
              const folderPath = path.join(dumpPath, type, className.slice(0, className.lastIndexOf('/')));
              files.push({ data, folderPath, type, className });
            }
          } else {
            console.error(`Failed to get props for ${className}`);
          }

        }

        fs.writeFileSync(path.join(dumpPath, 'Weapons'), JSON.stringify(weapons, null, 2));

        files.forEach(({ data, folderPath, type, className }, index) => {
          console.log(`Write: ${index + 1}/${files.length}: ${className}`);
          if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
          }
          fs.writeFileSync(path.join(dumpPath, type, className), data);
        });
      }

      const packageMatch = await this.omegga.watchLogChunk('GetAll Package', classRegExp, { first: 'index' });

      if (packageMatch.length) {
        const bricks = [];
        for (let i = 0; i < packageMatch.length; i++) {
          const { className } = packageMatch[i].groups;
          if (className.startsWith("/Game/Bricks/Procedural/") || className.startsWith("/Game/Bricks/Categories")) {
            const splitName = className.split('/');
            const brickName = splitName[splitName.length - 1]
            bricks.push(brickName);
          }
        }

        fs.writeFileSync(path.join(dumpPath, 'Bricks'), JSON.stringify(bricks, null, 2));
      }
    } catch (error) {
      console.error(error);
    }
  }

  stop() {
    this.omegga
      .removeListener('cmd:dumpall', this.dumpAll);

  }
}

module.exports = Dump;