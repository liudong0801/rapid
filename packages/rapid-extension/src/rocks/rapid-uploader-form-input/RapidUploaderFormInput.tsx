import { Rock, RockConfig, handleComponentEvent } from "@ruiapp/move-style";
import RapidToolbarLinkMeta from "./RapidUploaderFormInputMeta";
import { renderRock } from "@ruiapp/react-renderer";
import { RapidFileInfo, RapidUploaderFormInputRockConfig } from "./rapid-uploader-form-input-types";
import { Button, Upload, UploadFile, UploadProps } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { isArray, isString, remove, set } from "lodash";
import { useCallback, useMemo } from "react";
import { getExtensionLocaleStringResource } from "../../helpers/i18nHelper";

export default {
  $type: "rapidUploaderFormInput",

  Renderer(context, props) {
    const { framework } = context;
    const onUploadChange = useCallback<UploadProps["onChange"]>(
      (info) => {
        const file = info.file;
        if (file) {
          if (file.status === "done") {
            const rpdFileInfo: RapidFileInfo = {
              name: file.name,
              key: file.response.fileKey,
              size: file.size,
              type: file.type,
            };
            if (props.onUploaded) {
              const eventArgs = [rpdFileInfo];
              handleComponentEvent("onUploaded", context.framework, context.page, context.scope, props, props.onUploaded, eventArgs);
            } else {
              let value: RapidFileInfo | RapidFileInfo[] | undefined = props.value;
              if (props.multiple) {
                if (isArray(value)) {
                  (value as RapidFileInfo[]).push(rpdFileInfo);
                } else if (value) {
                  value = [value, rpdFileInfo];
                } else {
                  value = [rpdFileInfo];
                }
              } else {
                value = rpdFileInfo;
              }
              props.onChange?.(value);
            }
          }
        }
      },
      [props.value, props.onChange],
    );

    const onRemoveFile = useCallback<UploadProps["onRemove"]>(
      (file) => {
        let { value } = props;
        if (!value) {
          return;
        }

        if (isArray(value)) {
          const fileKey = file.response?.fileKey || file.uid;
          if (fileKey) {
            remove(value, (item) => item.key === fileKey);
          }
        } else {
          value = null;
        }

        props.onChange?.(value);
      },
      [props.value, props.onChange],
    );

    const defaultFileList = useMemo(() => {
      const { value } = props;
      if (!value) {
        return null;
      }
      if (isArray(value)) {
        return value.map(convertRpdFileInfoToAntdFileInfo);
      }

      return [convertRpdFileInfoToAntdFileInfo(value)];
    }, [props.value]);

    const buttonText = props.buttonText || getExtensionLocaleStringResource(framework, "uploadButtonText");
    if (!props.multiple) {
      set(props, "uploadProps.maxCount", 1);
    }

    return (
      <Upload {...props.uploadProps} defaultFileList={defaultFileList} onChange={onUploadChange} onRemove={onRemoveFile}>
        <Button icon={<UploadOutlined />}>{buttonText.toString()}</Button>
      </Upload>
    );
  },

  ...RapidToolbarLinkMeta,
} as Rock<RapidUploaderFormInputRockConfig>;

function convertRpdFileInfoToAntdFileInfo(source: RapidFileInfo): UploadFile {
  return {
    uid: source.key,
    name: source.name,
    size: source.size,
    type: source.type,
  };
}
