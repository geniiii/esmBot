#include <napi.h>
#include <list>
#include <Magick++.h>

using namespace std;
using namespace Magick;

class WatermarkWorker : public Napi::AsyncWorker {
 public:
  WatermarkWorker(Napi::Function& callback, string in_path, string water_path, int gravity, bool resize, bool append, bool mc, string type, int delay)
      : Napi::AsyncWorker(callback), in_path(in_path), water_path(water_path), gravity(gravity), resize(resize), append(append), mc(mc), type(type), delay(delay) {}
  ~WatermarkWorker() {}

  void Execute() {
    list<Image> frames;
    list<Image> coalesced;
    list<Image> mid;
    list<Image> result;
    Image watermark;
    readImages(&frames, in_path);
    watermark.read(water_path);
    if (resize && append) {
      string query(to_string(frames.front().baseColumns()) + "x");
      watermark.scale(Geometry(query));
    } else if (resize) {
      string query("x" + to_string(frames.front().baseRows()));
      watermark.scale(Geometry(query));
    }
    coalesceImages(&coalesced, frames.begin(), frames.end());

    for (Image &image : coalesced) {
      Image final;
      if (append) {
        list<Image> to_append;
        to_append.push_back(image);
        to_append.push_back(watermark);
        appendImages(&final, to_append.begin(), to_append.end(), true);
      } else if (mc) {
        image.backgroundColor("white");
        image.extent(Geometry(image.columns(), image.rows() + 15));
        image.composite(watermark, Magick::GravityType(gravity), Magick::OverCompositeOp);
        final = image;
      } else {
        image.composite(watermark, Magick::GravityType(gravity), Magick::OverCompositeOp);
        final = image;
      }
      image.magick(type);
      mid.push_back(final);
    }

    optimizeImageLayers(&result, mid.begin(), mid.end());
    if (delay != 0) for_each(result.begin(), result.end(), animationDelayImage(delay));
    writeImages(result.begin(), result.end(), &blob);
  }

  void OnOK() {
    Callback().Call({Env().Undefined(), Napi::Buffer<char>::Copy(Env(), (char *)blob.data(), blob.length())});
  }

 private:
  string in_path, water_path, type;
  int delay, gravity;
  Blob blob;
  bool resize, append, mc;
};

Napi::Value Watermark(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();

  string in_path = info[0].As<Napi::String>().Utf8Value();
  string water = info[1].As<Napi::String>().Utf8Value();
  int gravity = info[2].As<Napi::Number>().Int32Value();
  bool resize = info[3].As<Napi::Boolean>().Value();
  bool append = info[4].As<Napi::Boolean>().Value();
  bool mc = info[5].As<Napi::Boolean>().Value();
  string type = info[6].As<Napi::String>().Utf8Value();
  int delay = info[7].As<Napi::Number>().Int32Value();
  Napi::Function cb = info[8].As<Napi::Function>();

  WatermarkWorker* watermarkWorker = new WatermarkWorker(cb, in_path, water, gravity, resize, append, mc, type, delay);
  watermarkWorker->Queue();
  return env.Undefined();
}