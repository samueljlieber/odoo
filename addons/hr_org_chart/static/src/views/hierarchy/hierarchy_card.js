/** @odoo-module */

import { Component } from "@odoo/owl";

import { Field } from "@web/views/fields/field";
import { Record } from "@web/views/record";
import { ViewButton } from "@web/views/view_button/view_button";
import { useViewCompiler } from "@web/views/view_compiler";

import { OrgChartCompiler } from "./hierarchy_compiler";
import { getFormattedRecord } from "@web/views/kanban/kanban_record";

export class HierarchyCard extends Component {
    static components = {
        Record,
        Field,
        ViewButton,
    };
    static props = {
        node: Object,
        openRecord: Function,
        archInfo: Object,
        templates: Object,
        classNames: { type: String, optional: true },
    };
    static defaultProps = {
        classNames: "",
    };
    static template = "hr_org_chart.HierarchyCard";
    static Compiler = OrgChartCompiler;

    setup() {
        const { templates } = this.props;
        this.templates = useViewCompiler(this.constructor.Compiler, templates);
    }

    getRenderingContext(data) {
        const record = getFormattedRecord(data.record);
        return {
            context: this.props.node.context,
            JSON,
            luxon,
            record,
            __comp__: Object.assign(Object.create(this), { this: this }),
            __record__: data.record,
        };
    }

    onGlobalClick(ev) {
        if (ev.target.closest("button")) {
            return;
        }
        this.props.openRecord(this.props.node);
    }

    onClickArrowUp(ev) {
        this.props.node.fetchParentNode();
    }

    onClickArrowDown(ev) {
        if (this.props.node.nodes.length) {
            this.props.node.collapseChildNodes();
        } else {
            this.props.node.showChildNodes();
        }
    }
}
