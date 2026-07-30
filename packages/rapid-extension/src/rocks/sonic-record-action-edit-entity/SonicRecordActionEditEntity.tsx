import { MoveStyleUtils, RockEventHandler, RockEventHandlerNotifyEvent, RockInstanceContext, type Rock } from "@ruiapp/move-style";
import { renderRock } from "@ruiapp/react-renderer";
import RapidEntityListMeta from "./SonicRecordActionEditEntityMeta";
import type { SonicRecordActionEditEntityConfig, SonicRecordActionEditEntityRockConfig } from "./sonic-record-action-edit-entity-types";
import { RapidTableActionRockConfig } from "../rapid-table-action/rapid-table-action-types";
import { getExtensionLocaleStringResource } from "../../helpers/i18nHelper";
import { omit } from "lodash";
import { RapidEntityFormRockConfig } from "../rapid-entity-form/rapid-entity-form-types";

export default {
  onInit(context, props) {},

  onReceiveMessage(message, state, props) {},

  Renderer(context, props) {
    const { form } = props;

    if (form) {
      return renderActionWithSpecifiedForm(context, props);
    } else {
      return renderActionWithDefaultForm(context, props);
    }
  },

  ...RapidEntityListMeta,
} as Rock<SonicRecordActionEditEntityRockConfig>;

function renderActionWithDefaultForm(context: RockInstanceContext, props: SonicRecordActionEditEntityRockConfig) {
  const { framework } = context;
  // const slotIndex = props.$slot.index || "0";
  const entityId = props.$slot.record.id;

  const rockConfig: RapidTableActionRockConfig = {
    ...(MoveStyleUtils.omitSystemRockConfigFields(props) as SonicRecordActionEditEntityConfig),
    $id: `${props.$id}-link-${entityId}`,
    $type: "rapidTableAction",
    actionText: props.actionText || getExtensionLocaleStringResource(framework, "edit"),
    onAction: [
      {
        $action: "notifyEvent",
        eventName: "onEditEntityButtonClick",
        $exps: {
          args: "$event.args",
        },
      } satisfies RockEventHandlerNotifyEvent,
    ],
  };

  return renderRock({ context, rockConfig });
}

function renderActionWithSpecifiedForm(context: RockInstanceContext, props: SonicRecordActionEditEntityRockConfig) {
  // const slotIndex = props.$slot.index || "0";
  const entityId = props.$slot.record.id;
  const scopeId = context.scope.config.$id;
  const { entityCode, form, dataSourceCode } = props;

  const onSubmitSuccess = form.onSubmitSuccess || form.onSaveSuccess;
  const onSubmitError = form.onSubmitError || form.onSaveError;
  const rockConfig: RapidTableActionRockConfig = {
    ...(MoveStyleUtils.omitSystemRockConfigFields(props) as SonicRecordActionEditEntityConfig),
    $id: `${props.$id}-action`,
    $type: "rapidFormModalRecordAction",
    form: {
      $type: "rapidEntityForm",
      ...(form as RapidEntityFormRockConfig),
      entityCode,
      mode: "edit",
      entityId,
      beforeSubmit: [
        {
          $action: "setVars",
          vars: {
            "modal-saving": true,
          },
        },
      ],

      onSubmitSuccess: [
        {
          $action: "setVars",
          vars: {
            "modal-saving": false,
            "modal-open": false,
          },
        },
        ...(onSubmitSuccess ? (Array.isArray(onSubmitSuccess) ? onSubmitSuccess : [onSubmitSuccess]) : []),
        ...[
          {
            $action: "loadStoreData",
            scopeId,
            storeName: dataSourceCode,
          },
        ],
      ],
      onSubmitError: [
        {
          $action: "setVars",
          vars: {
            "modal-saving": false,
          },
        },
        ...(onSubmitError ? (Array.isArray(onSubmitError) ? onSubmitError : [onSubmitError]) : []),
      ],
    } satisfies RapidEntityFormRockConfig,
    onModalOpen: [
      {
        $action: "loadStoreData",
        scope: `${props.$id}-action-${entityId}`,
        storeName: "detail",
      },
    ],
  };

  return renderRock({ context, rockConfig });
}
