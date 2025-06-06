/** @odoo-module **/

import {
    makeFakeNotificationService,
    patchUserWithCleanup,
} from "@web/../tests/helpers/mock_services";
import {
    click,
    clickSave,
    editInput,
    getFixture,
    getNodesTextContent,
    nextTick,
    patchWithCleanup,
    selectDropdownItem,
    triggerHotkey,
} from "@web/../tests/helpers/utils";
import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";
import { createWebClient, doAction } from "@web/../tests/webclient/helpers";
import { browser } from "@web/core/browser/browser";
import { registry } from "@web/core/registry";

import { EventBus } from "@odoo/owl";

let serverData;
let target;

QUnit.module("Fields", (hooks) => {
    hooks.beforeEach(() => {
        target = getFixture();
        serverData = {
            models: {
                partner: {
                    fields: {
                        display_name: { string: "Displayed name", type: "char" },
                        foo: { string: "Foo", type: "char", default: "My little Foo Value" },
                        bar: { string: "Bar", type: "boolean", default: true },
                        int_field: { string: "int_field", type: "integer", sortable: true },
                        qux: { string: "Qux", type: "float", digits: [16, 1] },
                        p: {
                            string: "one2many field",
                            type: "one2many",
                            relation: "partner",
                            relation_field: "trululu",
                        },
                        trululu: { string: "Trululu", type: "many2one", relation: "partner" },
                        product_id: { string: "Product", type: "many2one", relation: "product" },
                        color: {
                            type: "selection",
                            selection: [
                                ["red", "Red"],
                                ["black", "Black"],
                            ],
                            default: "red",
                            string: "Color",
                        },
                        user_id: { string: "User", type: "many2one", relation: "user" },
                    },
                    records: [
                        {
                            id: 1,
                            display_name: "first record",
                            bar: true,
                            foo: "yop",
                            int_field: 10,
                            qux: 0.44,
                            p: [],
                            trululu: 4,
                            user_id: 17,
                        },
                        {
                            id: 2,
                            display_name: "second record",
                            bar: true,
                            foo: "blip",
                            int_field: 9,
                            qux: 13,
                            p: [],
                            trululu: 1,
                            product_id: 37,
                            user_id: 17,
                        },
                        {
                            id: 4,
                            display_name: "aaa",
                            bar: false,
                        },
                    ],
                },
                product: {
                    fields: {
                        name: { string: "Product Name", type: "char" },
                    },
                    records: [
                        {
                            id: 37,
                            display_name: "xphone",
                        },
                        {
                            id: 41,
                            display_name: "xpad",
                        },
                    ],
                },
                user: {
                    fields: {
                        name: { string: "Name", type: "char" },
                        partner_ids: {
                            string: "one2many partners field",
                            type: "one2many",
                            relation: "partner",
                            relation_field: "user_id",
                        },
                    },
                    records: [
                        {
                            id: 17,
                            name: "Aline",
                            partner_ids: [1, 2],
                        },
                        {
                            id: 19,
                            name: "Christine",
                        },
                    ],
                },
            },
        };

        setupViewRegistries();
    });

    QUnit.module("StatusBarField");

    QUnit.test("static statusbar widget on many2one field", async function (assert) {
        serverData.models.partner.fields.trululu.domain = "[('bar', '=', True)]";
        serverData.models.partner.records[1].bar = false;

        let count = 0;
        let fieldsFetched = [];
        await makeView({
            type: "form",
            resModel: "partner",
            resId: 1,
            serverData,
            arch: `
                <form>
                    <header>
                        <field name="trululu" widget="statusbar" />
                    </header>
                </form>`,
            mockRPC(route, { method, kwargs }) {
                if (method === "search_read") {
                    count++;
                    fieldsFetched = kwargs.fields;
                }
            },
        });

        assert.strictEqual(
            count,
            1,
            "once search_read should have been done to fetch the relational values"
        );
        assert.deepEqual(
            fieldsFetched,
            ["display_name"],
            "search_read should only fetch field display_name"
        );
        assert.containsN(target, ".o_statusbar_status button:not(.dropdown-toggle)", 2);
        assert.containsN(target, ".o_statusbar_status button:disabled", 2);
        assert.hasClass(
            target.querySelector('.o_statusbar_status button[data-value="4"]'),
            "o_arrow_button_current"
        );
    });

    QUnit.test(
        "folded statusbar widget on selection field has selected value in the toggler",
        async function (assert) {
            registry.category("services").add("ui", {
                start(env) {
                    Object.defineProperty(env, "isSmall", {
                        value: true,
                    });
                    return {
                        bus: new EventBus(),
                        size: 0,
                        isSmall: true,
                    };
                },
            });
            await makeView({
                type: "form",
                resModel: "partner",
                resId: 1,
                serverData,
                arch: `
                <form>
                    <header>
                        <field name="color" widget="statusbar" />
                    </header>
                </form>`,
            });

            assert.containsOnce(target, ".o_statusbar_status button.dropdown-toggle:contains(Red)");
        }
    );

    QUnit.test("static statusbar widget on many2one field with domain", async function (assert) {
        assert.expect(1);

        patchUserWithCleanup({ userId: 17 });

        await makeView({
            type: "form",
            resModel: "partner",
            resId: 1,
            serverData,
            arch: `
                <form>
                    <header>
                        <field name="trululu" widget="statusbar" domain="[('user_id', '=', uid)]" />
                    </header>
                </form>`,
            mockRPC(route, { method, kwargs }) {
                if (method === "search_read") {
                    assert.deepEqual(
                        kwargs.domain,
                        ["|", ["id", "=", 4], ["user_id", "=", 17]],
                        "search_read should sent the correct domain"
                    );
                }
            },
        });
    });

    QUnit.test("clickable statusbar widget on many2one field", async function (assert) {
        await makeView({
            type: "form",
            resModel: "partner",
            resId: 1,
            serverData,
            arch: `
                <form>
                    <header>
                        <field name="trululu" widget="statusbar" options="{'clickable': 1}" />
                    </header>
                </form>`,
        });

        assert.hasClass(
            target.querySelector(".o_statusbar_status button[data-value='4']"),
            "o_arrow_button_current"
        );
        assert.ok(target.querySelector(".o_statusbar_status button[data-value='4']").disabled);

        const clickableButtons = target.querySelectorAll(
            ".o_statusbar_status button.btn:not(.dropdown-toggle):not(:disabled):not(.o_arrow_button_current)"
        );
        assert.strictEqual(clickableButtons.length, 2);

        await click(clickableButtons[clickableButtons.length - 1]); // (last is visually the first here (css))

        assert.hasClass(
            target.querySelector(".o_statusbar_status button[data-value='1']"),
            "o_arrow_button_current"
        );
        assert.ok(target.querySelector(".o_statusbar_status button[data-value='1']").disabled);
    });

    QUnit.test("statusbar with no status", async function (assert) {
        serverData.models.product.records = [];
        await makeView({
            type: "form",
            resModel: "partner",
            resId: 1,
            serverData,
            arch: `
                <form>
                    <header>
                        <field name="product_id" widget="statusbar" />
                    </header>
                </form>`,
        });

        assert.doesNotHaveClass(target.querySelector(".o_statusbar_status"), "o_field_empty");
        assert.containsNone(
            target,
            ".o_statusbar_status > :not(.d-none)",
            "statusbar widget should be empty"
        );
    });

    QUnit.test("statusbar with tooltip for help text", async function (assert) {
        serverData.models.partner.fields.product_id.help = "some info about the field";
        await makeView({
            type: "form",
            resModel: "partner",
            resId: 1,
            serverData,
            arch: `
                <form>
                    <header>
                        <field name="product_id" widget="statusbar" />
                    </header>
                </form>`,
        });

        assert.doesNotHaveClass(target.querySelector(".o_statusbar_status"), "o_field_empty");
        const tooltipInfo =
            target.querySelector(".o_field_statusbar").attributes["data-tooltip-info"];
        assert.strictEqual(
            JSON.parse(tooltipInfo.value).field.help,
            "some info about the field",
            "tooltip text is present on the field"
        );
    });

    QUnit.test("statusbar with required modifier", async function (assert) {
        const mock = () => {
            assert.step("Show error message");
            return () => {};
        };
        registry.category("services").add("notification", makeFakeNotificationService(mock), {
            force: true,
        });

        await makeView({
            type: "form",
            resModel: "partner",
            serverData,
            arch: `
                <form>
                    <header>
                        <field name="product_id" widget="statusbar" required="1"/>
                    </header>
                </form>`,
        });

        await click(target, ".o_form_button_save");

        assert.containsOnce(target, ".o_form_editable", "view should still be in edit");
        assert.verifySteps(
            ["Show error message"],
            "should display an 'invalid fields' notification"
        );
    });

    QUnit.test("statusbar with no value in readonly", async function (assert) {
        await makeView({
            type: "form",
            resModel: "partner",
            resId: 1,
            serverData,
            arch: `
                <form>
                    <header>
                        <field name="product_id" widget="statusbar" />
                    </header>
                </form>`,
        });

        assert.doesNotHaveClass(target.querySelector(".o_statusbar_status"), "o_field_empty");
        assert.containsN(target, ".o_statusbar_status button:visible", 2);
    });

    QUnit.test("statusbar with domain but no value (create mode)", async function (assert) {
        serverData.models.partner.fields.trululu.domain = "[('bar', '=', True)]";

        await makeView({
            type: "form",
            resModel: "partner",
            serverData,
            arch: `
                <form>
                    <header>
                        <field name="trululu" widget="statusbar" />
                    </header>
                </form>`,
        });

        assert.containsN(target, ".o_statusbar_status button:disabled", 2);
    });

    QUnit.test(
        "clickable statusbar should change m2o fetching domain in edit mode",
        async function (assert) {
            serverData.models.partner.fields.trululu.domain = "[('bar', '=', True)]";

            await makeView({
                type: "form",
                resModel: "partner",
                resId: 1,
                serverData,
                arch: `
                    <form>
                        <header>
                            <field name="trululu" widget="statusbar" options="{'clickable': 1}" />
                        </header>
                    </form>`,
            });

            assert.containsN(target, ".o_statusbar_status button:not(.dropdown-toggle)", 3);
            const buttons = target.querySelectorAll(
                ".o_statusbar_status button:not(.dropdown-toggle)"
            );
            await click(buttons[buttons.length - 1]);
            await nextTick();
            assert.containsN(target, ".o_statusbar_status button:not(.dropdown-toggle)", 2);
        }
    );

    QUnit.test(
        "statusbar fold_field option and statusbar_visible attribute",
        async function (assert) {
            patchWithCleanup(browser, {
                setTimeout: (fn) => fn(),
            });

            serverData.models.partner.records[0].bar = false;

            await makeView({
                type: "form",
                resModel: "partner",
                resId: 1,
                serverData,
                arch: `
                    <form>
                        <header>
                            <field name="trululu" widget="statusbar" options="{'fold_field': 'bar'}" />
                            <field name="color" widget="statusbar" statusbar_visible="red" />
                        </header>
                    </form>`,
            });

            await click(target, ".o_statusbar_status .dropdown-toggle:not(.d-none)");

            const status = target.querySelectorAll(".o_statusbar_status");
            assert.containsOnce(status[0], ".dropdown-item.disabled");
            assert.containsOnce(status[status.length - 1], "button:disabled");
        }
    );

    QUnit.test("statusbar: choose an item from the folded menu", async function (assert) {
        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
        });

        serverData.models.partner.records[0].bar = false;

        await makeView({
            type: "form",
            resModel: "partner",
            resId: 1,
            serverData,
            arch: `
                <form>
                    <header>
                        <field name="trululu" widget="statusbar" options="{'clickable': '1', 'fold_field': 'bar'}" />
                    </header>
                </form>`,
        });

        assert.strictEqual(
            target.querySelector("[aria-label='Current state']").textContent,
            "aaa",
            "default status is 'aaa'"
        );
        assert.strictEqual(
            document
                .querySelector(".o_statusbar_status .dropdown-toggle.o_arrow_button")
                .textContent.trim(),
            "...",
            "button has the correct text"
        );

        await click(target, ".o_statusbar_status .dropdown-toggle:not(.d-none)");
        await click(target, ".o-dropdown .dropdown-item");
        assert.strictEqual(
            target.querySelector("[aria-label='Current state']").textContent,
            "second record",
            "status has changed to the selected dropdown item"
        );
    });

    QUnit.test("statusbar with dynamic domain", async function (assert) {
        serverData.models.partner.fields.trululu.domain = "[('int_field', '>', qux)]";
        serverData.models.partner.records[2].int_field = 0;

        let rpcCount = 0;
        await makeView({
            type: "form",
            resModel: "partner",
            resId: 1,
            serverData,
            arch: `
                <form>
                    <header>
                        <field name="trululu" widget="statusbar" />
                    </header>
                    <field name="qux" />
                    <field name="foo" />
                </form>`,
            mockRPC(route, { method }) {
                if (method === "search_read") {
                    rpcCount++;
                }
            },
        });

        assert.containsN(target, ".o_statusbar_status button:disabled", 3);
        assert.strictEqual(rpcCount, 1, "should have done 1 search_read rpc");
        await editInput(target, ".o_field_widget[name='qux'] input", 9.5);
        await nextTick();
        assert.containsN(target, ".o_statusbar_status button:disabled", 2);
        assert.strictEqual(rpcCount, 2, "should have done 1 more search_read rpc");
        await editInput(target, ".o_field_widget[name='qux'] input", "hey");
        assert.strictEqual(rpcCount, 2, "should not have done 1 more search_read rpc");
    });

    QUnit.test('statusbar edited by the smart action "Move to stage..."', async function (assert) {
        await makeView({
            serverData,
            type: "form",
            resModel: "partner",
            arch: `
                <form>
                    <header>
                        <field name="trululu" widget="statusbar" options="{'clickable': '1'}"/>
                    </header>
                </form>`,
            resId: 1,
        });

        assert.containsOnce(target, ".o_field_widget");

        triggerHotkey("control+k");
        await nextTick();
        const movestage = target.querySelectorAll(".o_command");
        const idx = [...movestage]
            .map((el) => el.textContent)
            .indexOf("Move to Trululu...ALT + SHIFT + X");
        assert.ok(idx >= 0);

        await click(movestage[idx]);
        await nextTick();
        assert.deepEqual(
            [...target.querySelectorAll(".o_command")].map((el) => el.textContent),
            ["first record", "second record", "aaa"]
        );
        await click(target, "#o_command_2");
    });

    QUnit.test("smart actions are unavailable if readonly", async function (assert) {
        await makeView({
            serverData,
            type: "form",
            resModel: "partner",
            arch: `
                    <form>
                        <header>
                            <field name="trululu" widget="statusbar" readonly="1"/>
                        </header>
                    </form>`,
            resId: 1,
        });

        assert.containsOnce(target, ".o_field_widget");

        triggerHotkey("control+k");
        await nextTick();
        const moveStages = [...target.querySelectorAll(".o_command")].map((el) => el.textContent);
        assert.notOk(moveStages.includes("Move to Trululu...ALT + SHIFT + X"));
        assert.notOk(moveStages.includes("Move to next...ALT + X"));
    });

    QUnit.test("hotkeys are unavailable if readonly", async function (assert) {
        await makeView({
            serverData,
            type: "form",
            resModel: "partner",
            arch: `
                    <form>
                        <header>
                            <field name="trululu" widget="statusbar" readonly="1"/>
                        </header>
                    </form>`,
            resId: 1,
        });

        assert.containsOnce(target, ".o_field_widget");
        triggerHotkey("alt+shift+x"); // Move to stage...
        await nextTick();
        assert.containsNone(target, ".modal", "command palette should not open");

        triggerHotkey("alt+x"); // Move to next
        await nextTick();
        assert.containsNone(target, ".modal", "command palette should not open");
    });

    QUnit.test("auto save record when field toggled", async function (assert) {
        await makeView({
            type: "form",
            resModel: "partner",
            resId: 1,
            serverData,
            arch: `
                <form>
                    <header>
                        <field name="trululu" widget="statusbar" options="{'clickable': 1}" />
                    </header>
                </form>`,
            mockRPC(_route, { method }) {
                if (method === "web_save") {
                    assert.step("web_save");
                }
            },
        });
        const clickableButtons = target.querySelectorAll(
            ".o_statusbar_status button.btn:not(.dropdown-toggle):not(:disabled):not(.o_arrow_button_current)"
        );
        await click(clickableButtons[clickableButtons.length - 1]);
        assert.verifySteps(["web_save"]);
    });

    QUnit.test(
        "For the same record, a single rpc is done to recover the specialData",
        async function (assert) {
            serverData.views = {
                "partner,3,list": '<tree><field name="display_name"/></tree>',
                "partner,9,search": `<search></search>`,
                "partner,false,form": `<form>
                <header>
                    <field name="trululu" widget="statusbar" readonly="1"/>
                </header>
            </form>`,
            };

            serverData.actions = {
                1: {
                    id: 1,
                    name: "Partners",
                    res_model: "partner",
                    type: "ir.actions.act_window",
                    views: [
                        [false, "list"],
                        [false, "form"],
                    ],
                },
            };

            const mockRPC = (route, args) => {
                if (args.method === "search_read") {
                    assert.step("search_read");
                }
            };

            const webClient = await createWebClient({ serverData, mockRPC });
            await doAction(webClient, 1);

            await click(target.querySelector(".o_data_row .o_data_cell"));
            assert.verifySteps(["search_read"]);

            await click(target, ".o_back_button");
            await click(target.querySelector(".o_data_row .o_data_cell"));
            assert.verifySteps([]);
        }
    );

    QUnit.test(
        "open form with statusbar, leave and come back to another one with other domain",
        async function (assert) {
            serverData.views = {
                "partner,3,list": '<tree><field name="display_name"/></tree>',
                "partner,9,search": `<search></search>`,
                "partner,false,form": `<form>
                <header>
                    <field name="trululu" widget="statusbar" domain="[['id', '>', id]]" readonly="1"/>
                </header>
            </form>`,
            };

            serverData.actions = {
                1: {
                    id: 1,
                    name: "Partners",
                    res_model: "partner",
                    type: "ir.actions.act_window",
                    views: [
                        [false, "list"],
                        [false, "form"],
                    ],
                },
            };

            const mockRPC = (route, args) => {
                if (args.method === "search_read") {
                    assert.step("search_read");
                }
            };

            const webClient = await createWebClient({ serverData, mockRPC });
            await doAction(webClient, 1);

            // open first record
            await click(target.querySelector(".o_data_row .o_data_cell"));
            assert.verifySteps(["search_read"]);

            // go back and open second record
            await click(target, ".o_back_button");
            await click(target.querySelectorAll(".o_data_row")[1].querySelector(".o_data_cell"));
            assert.verifySteps(["search_read"]);
        }
    );

    QUnit.test(
        "clickable statusbar with readonly modifier set to false is editable",
        async function (assert) {
            await makeView({
                type: "form",
                resModel: "partner",
                resId: 2,
                serverData,
                arch: `
                <form>
                    <header>
                        <field name="product_id" widget="statusbar" options="{'clickable': true}" readonly="False"/>
                    </header>
                </form>`,
            });
            assert.containsN(target, ".o_statusbar_status button:visible", 2);
            assert.containsNone(
                target,
                ".o_statusbar_status button[disabled][aria-checked='false']:visible"
            );
        }
    );

    QUnit.test(
        "clickable statusbar with readonly modifier set to true is not editable",
        async function (assert) {
            await makeView({
                type: "form",
                resModel: "partner",
                resId: 2,
                serverData,
                arch: `
                <form>
                    <header>
                        <field name="product_id" widget="statusbar" options="{'clickable': true}" readonly="True"/>
                    </header>
                </form>`,
            });
            assert.containsN(target, ".o_statusbar_status button[disabled]:visible", 2);
        }
    );

    QUnit.test(
        "non-clickable statusbar with readonly modifier set to false is not editable",
        async function (assert) {
            await makeView({
                type: "form",
                resModel: "partner",
                resId: 2,
                serverData,
                arch: `
                <form>
                    <header>
                        <field name="product_id" widget="statusbar" options="{'clickable': false}" readonly="False"/>
                    </header>
                </form>`,
            });
            assert.containsN(target, ".o_statusbar_status button[disabled]:visible", 2);
        }
    );

    QUnit.test(
        "last status bar button have a border radius (no arrow shape) on the right side when a prior folded stage gets selected",
        async function (assert) {
            serverData.models = {
                stage: {
                    fields: {
                        name: { string: "Name", type: "char" },
                        folded: { string: "Folded", type: "boolean", default: false },
                    },
                    records: [
                        { id: 1, name: "New" },
                        { id: 2, name: "In Progress", folded: true },
                        { id: 3, name: "Done" },
                    ],
                },
                task: {
                    fields: {
                        status: { string: "Status", type: "many2one", relation: "stage" },
                    },
                    records: [
                        { id: 1, status: 1 },
                        { id: 2, status: 2 },
                        { id: 3, status: 3 },
                    ],
                },
            };

            await makeView({
                type: "form",
                resModel: "task",
                resId: 3,
                serverData,
                arch: `
                <form>
                    <header>
                        <field name="status" widget="statusbar" options="{'clickable': true, 'fold_field': 'folded'}" />
                    </header>
                </form>`,
            });
            await click(target, ".o_statusbar_status .dropdown-toggle:not(.d-none)");
            await click(target, ".o-dropdown .dropdown-item");

            const button = target.querySelector(".o_statusbar_status button[data-value='3']");
            assert.notEqual(button.style.borderTopRightRadius, "0px");
            assert.hasClass(button, "o_first");
        }
    );

    QUnit.test("correctly load statusbar when dynamic domain changes", async function (assert) {
        serverData.models = {
            stage: {
                fields: {
                    name: { string: "Name", type: "char" },
                    folded: { string: "Folded", type: "boolean", default: false },
                    project_ids: { string: "Project", type: "many2many", relation: "project" },
                },
                records: [
                    { id: 1, name: "Stage Project 1", project_ids: [1] },
                    { id: 2, name: "Stage Project 2", project_ids: [2] },
                ],
            },
            project: {
                fields: {
                    display_name: { string: "Name", type: "char" },
                },
                records: [
                    { id: 1, display_name: "Project 1" },
                    { id: 2, display_name: "Project 2" },
                ],
            },
            task: {
                fields: {
                    status: { string: "Status", type: "many2one", relation: "stage" },
                    project_id: { string: "Project", type: "many2one", relation: "project" },
                },
                records: [{ id: 1, project_id: 1, status: 1 }],
            },
        };
        serverData.models.task.onchanges = {
            project_id: (obj) => {
                obj.status = obj.project_id === 1 ? 1 : 2;
            },
        };

        await makeView({
            type: "form",
            resModel: "task",
            resId: 1,
            serverData,
            arch: `
                <form>
                    <header>
                    <field name="status" widget="statusbar" domain="[('project_ids', 'in', project_id)]" />
                    </header>
                    <field name="project_id"/>
                </form>`,
            mockRPC(route, args) {
                if (args.method === "search_read") {
                    assert.step(JSON.stringify(args.kwargs.domain));
                }
            },
        });

        assert.deepEqual(
            getNodesTextContent(target.querySelectorAll(".o_statusbar_status button:not(.d-none)")),
            ["Stage Project 1"]
        );
        assert.verifySteps(['["|",["id","=",1],["project_ids","in",1]]']);
        await selectDropdownItem(target, "project_id", "Project 2");
        assert.deepEqual(
            getNodesTextContent(target.querySelectorAll(".o_statusbar_status button:not(.d-none)")),
            ["Stage Project 2"]
        );
        assert.verifySteps(['["|",["id","=",2],["project_ids","in",2]]']);
        await clickSave(target);
        assert.deepEqual(
            getNodesTextContent(target.querySelectorAll(".o_statusbar_status button:not(.d-none)")),
            ["Stage Project 2"]
        );
        assert.verifySteps([]);
    });
});
