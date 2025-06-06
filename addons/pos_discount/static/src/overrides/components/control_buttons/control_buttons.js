/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { NumberPopup } from "@point_of_sale/app/utils/input_popups/number_popup";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { ControlButtons } from "@point_of_sale/app/screens/product_screen/control_buttons/control_buttons";
import { patch } from "@web/core/utils/patch";

patch(ControlButtons.prototype, {
    async clickDiscount() {
        this.dialog.add(NumberPopup, {
            title: _t("Discount Percentage"),
            startingValue: this.pos.config.discount_pc,
            isInputSelected: true,
            getPayload: (num) => {
                const val = Math.max(0, Math.min(100, this.env.utils.parseValidFloat(num)));
                this.apply_discount(val);
            },
        });
    },
    // FIXME business method in a compoenent, maybe to move in pos_store
    async apply_discount(pc) {
        const order = this.pos.get_order();
        const lines = order.get_orderlines();
        const product = this.pos.config.discount_product_id;

        if (product === undefined) {
            this.dialog.add(AlertDialog, {
                title: _t("No discount product found"),
                body: _t(
                    "The discount product seems misconfigured. Make sure it is flagged as 'Can be Sold' and 'Available in Point of Sale'."
                ),
            });
            return;
        }
        // Remove existing discounts
        lines
            .filter((line) => line.get_product() === product)
            .forEach((line) => order._unlinkOrderline(line));

        // Add one discount line per tax group
        const linesByTax = order.get_orderlines_grouped_by_tax_ids();
        for (const [tax_ids, lines] of Object.entries(linesByTax)) {
            // Note that tax_ids_array is an Array of tax_ids that apply to these lines
            // That is, the use case of products with more than one tax is supported.
            const tax_ids_array = tax_ids
                .split(",")
                .filter((id) => id !== "")
                .map((id) => Number(id));

            const baseToDiscount = order.calculate_base_amount(
                tax_ids_array,
                lines.filter((ll) => ll.isGlobalDiscountApplicable())
            );

            const taxIds = this.pos.models["account.tax"].filter((tax) =>
                tax_ids_array.includes(tax.id)
            );
            // We add the price as manually set to avoid recomputation when changing customer.
            const discount = (-pc / 100.0) * baseToDiscount;
            if (discount < 0) {
                order.add_product(product, {
                    price: discount,
                    lst_price: discount,
                    tax_ids: taxIds,
                    merge: false,
                    description:
                        `${pc}%, ` +
                        (tax_ids_array.length
                            ? _t("Tax: %s", taxIds.map((tax) => tax.amount + "%").join(", "))
                            : _t("No tax")),
                    extras: {
                        price_type: "automatic",
                    },
                });
            }
        }
    },
});
