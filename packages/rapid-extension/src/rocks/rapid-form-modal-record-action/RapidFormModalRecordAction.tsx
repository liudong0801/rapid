import { MoveStyleUtils, RockEventHandler, RuiEvent, handleComponentEvent, type Rock, type RockConfig } from "@ruiapp/move-style";
import { renderRock } from "@ruiapp/react-renderer";
import RapidFormModalRecordActionMeta from "./RapidFormModalRecordActionMeta";
import type { RapidFormModalRecordActionRockConfig } from "./rapid-form-modal-record-action-types";
import { cloneDeep, set } from "lodash";
import { message } from "antd";
import { RapidFormRockConfig } from "../rapid-form/rapid-form-types";
import { getExtensionLocaleStringResource } from "../../helpers/i18nHelper";

export default {
  onInit(context, props) {},

  onReceiveMessage(message, state, props) {},

  Renderer(context, props) {
    const { framework } = context;
    const { resetFormOnModalOpen } = props;

    // TODO: need a better implementation. a component should not care about whether it's in a slot.
    // const slotIndex = props.$slot.index || "0";
    const recordId = props.$slot.record.id || props.$slot.index || "0";
    const formRockId = `${props.$id}-form-${recordId}`;
    const formRockConfig = cloneDeep(props.form) as RapidFormRockConfig;
    formRockConfig.$id = formRockId;

    formRockConfig.beforeSubmit = [
      {
        $action: "setVars",
        vars: {
          "modal-saving": true,
        },
      },
      ...(((props.form.beforeSubmit || props.form.beforeSubmit) as RockEventHandler[]) || []),
    ];

    formRockConfig.onSubmitSuccess = [
      {
        $action: "setVars",
        vars: {
          "modal-saving": false,
          "modal-open": false,
        },
      },
      ...(((props.form.onSubmitSuccess || props.form.onSaveSuccess) as RockEventHandler[]) || []),
    ];

    formRockConfig.onSubmitError = [
      {
        $action: "setVars",
        vars: {
          "modal-saving": false,
        },
      },
      ...(((props.form.onSubmitError || props.form.onSaveError) as RockEventHandler[]) || []),
    ];

    formRockConfig.onSubmit = [
      {
        $action: "script",
        script: async (event: RuiEvent) => {
          event.scope.setVars({
            "modal-saving": true,
          });

          const onSubmit = props.onSubmit || props.onFormSubmit;
          try {
            if (onSubmit) {
              await handleComponentEvent("onSubmit", event.framework, event.page as any, event.scope, event.sender, onSubmit, [event.args[0]]);
            }

            event.scope.setVars({
              "modal-saving": false,
              "modal-open": false,
            });
            message.success(props.successMessage);
          } catch (ex) {
            event.scope.setVars({
              "modal-saving": false,
            });
            let errMsg = ex.message;
            if (props.errorMessage) {
              errMsg = props.errorMessage + errMsg;
            }
            message.error(errMsg);
          }
        },
      },
    ];
    set(formRockConfig, "$exps._hidden", "!$scope.vars['modal-open']");

    const actionLinkRockConfig: RockConfig = {
      ...MoveStyleUtils.omitSystemRockConfigFields(props),
      $id: `${props.$id}-link-${recordId}`,
      $type: "rapidTableAction",
      onAction: [
        {
          $action: "setVars",
          vars: {
            "modal-open": true,
          },
        },
        ...(resetFormOnModalOpen
          ? [
              {
                $action: "sendComponentMessage",
                componentId: formRockId,
                message: {
                  name: "resetFields",
                },
              },
            ]
          : []),
        {
          $action: "handleEvent",
          eventName: "onModalOpen",
          handlers: props.onModalOpen,
        },
      ],
    };

    const modalRockConfig: RockConfig = {
      $type: "antdModal",
      $id: `${props.$id}-modal-${recordId}`,
      title: props.modalTitle || props.text,
      $exps: {
        open: "!!$scope.vars['modal-open']",
        confirmLoading: "!!$scope.vars['modal-saving']",
      },
      children: formRockConfig,
      okText: getExtensionLocaleStringResource(framework, "ok"),
      cancelText: getExtensionLocaleStringResource(framework, "cancel"),
      onOk: [
        {
          $action: "sendComponentMessage",
          componentId: formRockId,
          message: {
            name: "submit",
          },
        },
      ],
      onCancel: [
        {
          $action: "handleEvent",
          eventName: "onModalCancel",
          handlers: props.onModalCancel,
        },
        {
          $action: "setVars",
          vars: {
            "modal-open": false,
          },
        },
      ],
    };

    const rockConfig: RockConfig = {
      $type: "scope",
      $id: `${props.$id}-scope-${recordId}`,
      children: [actionLinkRockConfig, modalRockConfig],
    };

    return renderRock({ context, rockConfig: rockConfig });
  },

  ...RapidFormModalRecordActionMeta,
} as Rock<RapidFormModalRecordActionRockConfig>;
