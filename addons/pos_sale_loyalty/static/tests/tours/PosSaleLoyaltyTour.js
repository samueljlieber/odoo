/** @odoo-module **/

import * as Dialog from "@point_of_sale/../tests/tours/helpers/DialogTourMethods";
import * as PaymentScreen from "@point_of_sale/../tests/tours/helpers/PaymentScreenTourMethods";
import * as ReceiptScreen from "@point_of_sale/../tests/tours/helpers/ReceiptScreenTourMethods";
import * as ProductScreenPos from "@point_of_sale/../tests/tours/helpers/ProductScreenTourMethods";
import * as ProductScreenSale from "@pos_sale/../tests/helpers/ProductScreenTourMethods";
const ProductScreen = { ...ProductScreenPos, ...ProductScreenSale };
import { registry } from "@web/core/registry";

registry
    .category("web_tour.tours")
    .add('PosSaleLoyaltyTour1', {
        test: true,
        url: '/pos/ui',
        steps: () => [
            Dialog.confirm("Open session"),
            ProductScreen.controlButton("Quotation/Order"),
            ProductScreen.selectFirstOrder(),
            ProductScreen.clickDisplayedProduct('Desk Pad'),
            ProductScreen.clickPayButton(),
            PaymentScreen.clickPaymentMethod('Bank'),
            PaymentScreen.clickValidate(),
            ReceiptScreen.isShown(),
        ].flat(),
    });
