#include <napi.h>
#include <list>
#include <Magick++.h>

using namespace std;
using namespace Magick;

class InvertWorker : public Napi::AsyncWorker {
 public:
  InvertWorker(Napi::Function& callback, string in_path, string type, int delay)
      : Napi::AsyncWorker(callback), in_path(in_path), type(type), delay(delay) {}
  ~InvertWorker() {}

  void Execute() {
    list<Image> frames;
    list<Image> coalesced;
    list<Image> inverted;
    list<Image> result;
    readImages(&frames, in_path);
    coalesceImages(&coalesced, frames.begin(), frames.end());

    for (Image &image : coalesced) {
      image.negateChannel(Magick::ChannelType(Magick::CompositeChannels ^ Magick::AlphaChannel));
      image.magick(type);
      inverted.push_back(image);
    }

    optimizeImageLayers(&result, inverted.begin(), inverted.end());
    if (delay != 0) for_each(result.begin(), result.end(), animationDelayImage(delay));
    writeImages(result.begin(), result.end(), &blob);
  }

  void OnOK() {
    Callback().Call({Env().Undefined(), Napi::Buffer<char>::Copy(Env(), (char *)blob.data(), blob.length())});
  }

 private:
  string in_path, type;
  int delay;
  Blob blob;
};

Napi::Value Invert(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();

  string in_path = info[0].As<Napi::String>().Utf8Value();
  string type = info[1].As<Napi::String>().Utf8Value();
  int delay = info[2].As<Napi::Number>().Int32Value();
  Napi::Function cb = info[3].As<Napi::Function>();

  InvertWorker* invertWorker = new InvertWorker(cb, in_path, type, delay);
  invertWorker->Queue();
  return env.Undefined();
}