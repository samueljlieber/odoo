/** @odoo-module */

import * as Order from "@point_of_sale/../tests/tours/helpers/generic_components/OrderWidgetMethods";
import * as ProductScreen from "@point_of_sale/../tests/tours/helpers/ProductScreenTourMethods";
import * as TextInputPopup from "@point_of_sale/../tests/tours/helpers/TextInputPopupTourMethods";
import * as PaymentScreen from "@point_of_sale/../tests/tours/helpers/PaymentScreenTourMethods";
import * as ReceiptScreen from "@point_of_sale/../tests/tours/helpers/ReceiptScreenTourMethods";
import * as Dialog from "@point_of_sale/../tests/tours/helpers/DialogTourMethods";

export function selectRewardLine(rewardName) {
    return [
        ...Order.hasLine({
            withClass: ".fst-italic",
            withoutClass: ".selected",
            run: "click",
            productName: rewardName,
        }),
        ...Order.hasLine({
            withClass: ".selected.fst-italic",
            productName: rewardName,
        }),
    ];
}
export function enterCode(code) {
    return [
        ProductScreen.controlButton("Enter Code"),
        TextInputPopup.inputText(code),
        Dialog.confirm(),
    ];
}
export function clickEWalletButton(text = "eWallet") {
    return [{ trigger: ProductScreen.controlButtonTrigger(text) }];
}
export function claimReward(rewardName) {
    return [
        ProductScreen.controlButton("Reward"),
        {
            content: "select reward",
            // There should be description because a program always has a name.
            extra_trigger: ".selection-item span:nth-child(2)",
            trigger: `.selection-item:contains("${rewardName}")`,
        },
    ];
}
export function unselectPartner() {
    return [{ trigger: ".unselect-tag" }];
}
export function clickDiscountButton() {
    return [
        {
            content: "click discount button",
            trigger: ".js_discount",
        },
    ];
}
export function hasRewardLine(rewardName, amount, qty) {
    return Order.hasLine({
        withClass: ".fst-italic",
        productName: rewardName,
        price: amount,
        quantity: qty,
    });
}
export function orderTotalIs(total_str) {
    return [Order.hasTotal(total_str)];
}
export function isRewardButtonHighlighted(isHighlighted) {
    return [
        {
            trigger: isHighlighted
                ? '.control-buttons button.highlight:contains("Reward")'
                : '.control-buttons button:contains("Reward"):not(:has(.highlight))',
            run: function () {}, // it's a check
        },
    ];
}
export function eWalletButtonState({ highlighted, text = "eWallet" }) {
    return [
        {
            trigger: highlighted
                ? `.control-buttons button.highlight:contains("${text}")`
                : `.control-buttons button:contains("${text}"):not(:has(.highlight))`,
            run: function () {}, // it's a check
        },
    ];
}
export function customerIs(name) {
    return [
        {
            trigger: `.product-screen .set-partner:contains("${name}")`,
            run: function () {},
        },
    ];
}
export function notificationMessageContains(str) {
    return [
        {
            trigger: `.o_notification span:contains("${str}")`,
            run: function () {},
        },
    ];
}
export function finalizeOrder(paymentMethod, amount) {
    return [
        ...ProductScreen.clickPayButton(),
        ...PaymentScreen.clickPaymentMethod(paymentMethod),
        ...PaymentScreen.pressNumpad([...amount].join(" ")),
        ...PaymentScreen.clickValidate(),
        ...ReceiptScreen.clickNextOrder(),
    ];
}
export function removeRewardLine(name) {
    return [selectRewardLine(name), ProductScreen.pressNumpad("⌫"), Dialog.confirm()].flat();
}

export function checkAddedLoyaltyPoints(points) {
    return [
        {
            trigger: `.loyalty-points-won:contains("${points}")`,
            run: function () {}
        }
    ]
}
