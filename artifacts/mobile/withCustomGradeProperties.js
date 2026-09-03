const { withGradleProperties } = require('@expo/config-plugins');

module.exports = function withCustomGradleProperties(config) {
  return withGradleProperties(config, (config) => {
    const props = [
      { key: 'org.gradle.jvmargs', value: '-Xmx4096m -XX:MaxMetaspaceSize=1024m' },
      { key: 'org.gradle.workers.max', value: '2' },
      { key: 'org.gradle.parallel', value: 'false' },
      { key: 'org.gradle.caching', value: 'true' },
    ];

    props.forEach(({ key, value }) => {
      // remove any existing entry for this key, then add the new one
      config.modResults = config.modResults.filter((item) => item.key !== key);
      config.modResults.push({ type: 'property', key, value });
    });

    return config;
  });
};