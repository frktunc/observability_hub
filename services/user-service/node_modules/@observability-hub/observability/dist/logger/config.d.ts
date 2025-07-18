import { LogClientConfig } from './types';
export type FullLogClientConfig = Required<Omit<LogClientConfig, 'rabbitmqUsername' | 'rabbitmqPassword' | 'rabbitmqUrl'>> & {
    rabbitmqUrl?: string;
    rabbitmqUsername?: string;
    rabbitmqPassword?: string;
};
export declare function createDefaultConfig(config: LogClientConfig): FullLogClientConfig;
//# sourceMappingURL=config.d.ts.map