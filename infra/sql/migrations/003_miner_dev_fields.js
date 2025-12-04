/* eslint-disable @typescript-eslint/no-var-requires */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.alterColumn('miners', 'hashrate', { default: 0 });
  pgm.sql(`UPDATE miners SET hashrate = 0 WHERE hashrate IS NULL`);
  pgm.addColumn('miners', {
    miner_type: { type: 'varchar(64)', notNull: false },
    device_info: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") }
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('miners', 'miner_type');
  pgm.dropColumn('miners', 'device_info');
  pgm.alterColumn('miners', 'hashrate', { default: null });
};
