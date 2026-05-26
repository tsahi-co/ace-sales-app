import { ImageSourcePropType } from 'react-native';

export interface BrandAttribute {
  code: string;
  valueMap: Record<string, string>;
  defaultLabel: string;
}

export interface BrandConfig {
  id: string;
  name: string;
  logo: ImageSourcePropType;
  primaryColor: string;
  baseUrl: string;
  hasTFA: boolean;
  getSkuData: () => Record<string, any>;
  attributes: {
    brand: BrandAttribute;
    type: BrandAttribute;
  };
  tokenKey: string;
  proxyPrefix: string;
  statusFilter?: string[];
  allowedPhones?: string[];
  hasForecast?: boolean;
}

const skuDataCache: Record<string, Record<string, any>> = {};

function loadSkuData(brandId: string): Record<string, any> {
  if (skuDataCache[brandId]) return skuDataCache[brandId];
  try {
    switch (brandId) {
      case 'ace':
        skuDataCache[brandId] = require('../data/skuBrands.json');
        break;
      case 'beitili':
        skuDataCache[brandId] = require('../data/brand2Skus.json');
        break;
      case 'urban':
        skuDataCache[brandId] = require('../data/brand3Skus.json');
        break;
      default:
        skuDataCache[brandId] = {};
    }
  } catch {
    skuDataCache[brandId] = {};
  }
  return skuDataCache[brandId];
}

export const BRANDS: Record<string, BrandConfig> = {
  ace: {
    id: 'ace',
    name: 'ACE',
    logo: require('../../assets/ace.png'),
    primaryColor: '#cc0000',
    baseUrl: 'https://www.ace.co.il/rest/all/V1',
    hasTFA: true,
    getSkuData: () => loadSkuData('ace'),
    attributes: {
      brand: {
        code: 'specforweb2',
        valueMap: { Y1: 'Ace', AD: 'Autodepot' },
        defaultLabel: 'Not Related',
      },
      type: {
        code: 'marketplace',
        valueMap: { '448': 'Market Place' },
        defaultLabel: 'ACE Product',
      },
    },
    tokenKey: 'magento_token_ace',
    proxyPrefix: '/api/ace',
    allowedPhones: ['+972542828277', '+972525535527', '+972547998504'],
    hasForecast: true,
  },
  beitili: {
    id: 'beitili',
    name: 'Beitili',
    logo: require('../../assets/beitili.png'),
    primaryColor: '#0055aa',
    baseUrl: 'https://www.betili-shop.com/rest/all/V1',
    hasTFA: false,
    getSkuData: () => loadSkuData('beitili'),
    attributes: {
      brand: { code: 'REPLACE_ME', valueMap: {}, defaultLabel: 'Not Related' },
      type: { code: 'REPLACE_ME', valueMap: {}, defaultLabel: 'Unknown' },
    },
    tokenKey: 'magento_token_beitili',
    proxyPrefix: '/api/beitili',
    statusFilter: ['holded', 'carmel_pelecard_success'],
    allowedPhones: ['+972542828277', '+972507260199', '+972547998504'],
  },
  urban: {
    id: 'urban',
    name: 'Urban',
    logo: require('../../assets/urban.png'),
    primaryColor: '#007744',
    baseUrl: 'https://urban-shop.co.il/rest/all/V1',
    hasTFA: false,
    getSkuData: () => loadSkuData('urban'),
    attributes: {
      brand: { code: 'REPLACE_ME', valueMap: {}, defaultLabel: 'Not Related' },
      type: { code: 'REPLACE_ME', valueMap: {}, defaultLabel: 'Unknown' },
    },
    tokenKey: 'magento_token_urban',
    proxyPrefix: '/api/urban',
    statusFilter: ['holded', 'carmel_pelecard_success'],
    allowedPhones: ['+972542828277', '+972507260199', '+972547998504'],
  },
};

export const BRAND_LIST = Object.values(BRANDS);
export type BrandId = keyof typeof BRANDS;
