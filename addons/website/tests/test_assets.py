# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import re

import odoo.tests

from odoo.tools import config


@odoo.tests.common.tagged('post_install', '-at_install')
class TestWebsiteAssets(odoo.tests.HttpCase):

    def test_01_multi_domain_assets_generation(self):
        Website = self.env['website']
        Attachment = self.env['ir.attachment']
        # Simulate single website DBs: make sure other website do not interfer
        # (We can't delete those, constraint will most likely be raised)
        Website.search([]).write({'domain': 'inactive.test'})
        # Don't use HOST, hardcode it so it doesn't get changed one day and make
        # the test useless
        domain_1 = "http://127.0.0.1:%s" % config['http_port']
        domain_2 = "http://localhost:%s" % config['http_port']
        Website.browse(1).domain = domain_1

        self.authenticate('admin', 'admin')
        self.env['web_editor.assets'].with_context(website_id=1).make_scss_customization(
            '/website/static/src/scss/options/colors/user_color_palette.scss',
            {"o-cc1-bg": "'400'"},
        )

        def get_last_backend_asset_attach_id():
            return Attachment.search([
                ('name', '=', 'web.assets_backend.min.js'),
            ], order="id desc", limit=1).id

        def check_asset():
            self.assertEqual(last_backend_asset_attach_id, get_last_backend_asset_attach_id())

        last_backend_asset_attach_id = get_last_backend_asset_attach_id()

        # The first call will generate the assets and populate the cache and
        # take ~100 SQL Queries (~cold state).
        # Any later call to `/web`, regardless of the domain, will take only
        # ~10 SQL Queries (hot state).
        # Without the calls the `check_asset()` (which would raise early and
        # would not call other `url_open()`) and before the fix coming with this
        # test, here is the logs:
        #      "GET /web HTTP/1.1" 200 - 222 0.135 3.840  <-- 222 Queries, ~4s
        #      "GET /web HTTP/1.1" 200 - 181 0.101 3.692  <-- 181 Queries, ~4s
        #      "GET /web HTTP/1.1" 200 - 215 0.121 3.704  <-- 215 Queries, ~4s
        #      "GET /web HTTP/1.1" 200 - 181 0.100 3.616  <-- 181 Queries, ~4s
        # After the fix, here is the logs:
        #      "GET /web HTTP/1.1" 200 - 101 0.043 0.353  <-- 101 Queries, ~0.3s
        #      "GET /web HTTP/1.1" 200 - 11 0.004 0.007   <--  11 Queries, ~10ms
        #      "GET /web HTTP/1.1" 200 - 11 0.003 0.005   <--  11 Queries, ~10ms
        #      "GET /web HTTP/1.1" 200 - 11 0.003 0.008   <--  11 Queries, ~10ms
        self.url_open(domain_1 + '/web')
        check_asset()
        self.url_open(domain_2 + '/web')
        check_asset()
        self.url_open(domain_1 + '/web')
        check_asset()
        self.url_open(domain_2 + '/web')
        check_asset()
        self.url_open(domain_1 + '/web')
        check_asset()

    def test_02_t_cache_invalidation(self):
        self.authenticate(None, None)
        page = self.url_open('/').text # add to cache
        public_assets_links = re.findall(r'(/web/assets/.+/web.assets_frontend\..+)"/>', page)
        self.assertTrue(public_assets_links)
        self.authenticate('admin', 'admin')
        page = self.url_open('/').text
        admin_assets_links = re.findall(r'(/web/assets/.+/web.assets_frontend\..+)"/>', page)
        self.assertTrue(admin_assets_links)

        self.assertEqual(public_assets_links, admin_assets_links)

        snippets = self.env['ir.asset'].search([
            ('path', '=like', 'website/static/src/snippets/s_social_media/000.scss'), # arbitrary, a unused css one that doesn't make the page fail when archived.
            ('bundle', '=', 'web.assets_frontend'),
        ])
        self.assertTrue(snippets)
        write_dates = snippets.mapped('write_date')
        snippets.write({'active': False})
        snippets.flush_recordset()
        self.assertNotEqual(write_dates, snippets.mapped('write_date'))

        page = self.url_open('/').text
        new_admin_assets_links = re.findall(r'(/web/assets/.+/web.assets_frontend\..+)"/>', page)
        self.assertTrue(new_admin_assets_links)

        self.assertEqual(public_assets_links, admin_assets_links)
        self.assertNotEqual(new_admin_assets_links, admin_assets_links, "we expect a change since ir_assets were written")

        self.authenticate(None, None)
        page = self.url_open('/').text

        new_public_assets_links = re.findall(r'(/web/assets/.+/web.assets_frontend\..+)"/>', page)
        self.assertEqual(new_admin_assets_links, new_public_assets_links, "t-cache should have been invalidated for public user too")
