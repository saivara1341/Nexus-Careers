import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.nexuscareers.platform',
    appName: 'Nexus Careers',
    webDir: 'dist',
    server: {
        androidScheme: 'https'
    }
};

export default config;
