import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { errorMessage } from '../lib/errors';

describe('errorMessage', () => {
  it('ağ hatalarını çevirir', () => {
    assert.match(errorMessage(new TypeError('Network request failed')), /İnternet bağlantısı/);
    assert.match(errorMessage(new TypeError('Failed to fetch')), /İnternet bağlantısı/);
  });
  it('giriş hatalarını çevirir', () => assert.equal(errorMessage(new Error('Invalid login credentials')), 'E-posta ya da şifre hatalı.'));
  it('RLS hatasını çevirir', () => assert.match(errorMessage('new row violates row-level security policy'), /yetkiniz yok/));
  it('bilinmeyen hatayı olduğu gibi bırakır', () => assert.equal(errorMessage(new Error('Tarih hatalı')), 'Tarih hatalı'));
  it('boş hata için genel mesaj', () => assert.equal(errorMessage(undefined), 'Beklenmeyen bir hata oluştu.'));
});
